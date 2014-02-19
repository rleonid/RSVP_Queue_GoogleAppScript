/**
 * What is the state of this email address, ex has it confirmed a reservation?
 * Used in the spreadsheet that keeps track of the state.
 *
 * @param {String} email where to setup.
 * @return {String} current state.
 */
function getState(email){
  var db = ScriptDb.getMyDb();
  var res = db.query({email:email});
  if(res.hasNext()){
    var pair = res.next();
    return pair.state;
  } else {
    return "";
  }
}

/**
 * Remove all state information for this email address.
 *
 * @param {String} email
 * @return {ScriptDb} for chaining
 */
function clearState(email){
  var db = ScriptDb.getMyDb();
  var res = db.query({email:email});
  while(res.hasNext()){
    db.remove(res.next());
  }
  return db;
}

/**
 * A constructor of the meta dat that we keep track of in the DB
 * to run the invite logic.
 *
 * @param {String} spreadsheetUrl
 * @param {String} guests
 * @param {String} eventName 
 * @param {String} message
 * @param {number} timeOutHours 
 * @param {number} numYes 
 */
function Meta(url, guests, eventName, message, timeOutHours, numYes){
  this.spreadsheetUrl = url;
  this.guests = guests;
  this.eventName = eventName;
  this.message = message;
  this.timeOutHours = timeOutHours;
  this.numYes = numYes;
}

/**
 * Save the meta data associated with invite queue.
 *
 * @param {Meta} meta
 */
function saveMeta(m){
  var db = ScriptDb.getMyDb();
  db.save({ type:'meta', data:m });
  return db;
}

/**
 * Load the meta data associated with the invite queue.
*
 * @return {Meta} meta 
 */
function loadMeta(){
  var db = ScriptDb.getMyDb();
  var res = db.query({ type: 'meta', data: db.anyValue()});
  if (res.hasNext()){
    return res.next().data;
  } else {
    return null;
  }
}

/**
 * Constructor for the global state.
 */
function GlobalState(meta,db,accepted) {
  this.meta = meta;
  this.db = db;
  this.accepted = accepted;
}

/**
 * The state associated with the invite queue, useful for gathering some
 * needed data for several functions.
 * 1. The script db
 * 2. The meta data
 * 3. The number of accepted guests.
 *
 * @return {GlobalState}
 */
function loadGlobalState() {
  var meta = loadMeta();
  var db = ScriptDb.getMyDb();
  var res = db.query({state: acceptedState});
  var accepted = res.getSize();
  return new GlobalState(meta, db, accepted);
}


/**
 * Convert number of hours into milliseconds. Used for scheduling timeouts.
 *
 * @param {number} hours
 * @returns {number} the number of milliseconds in the given hours.
 *
 * TODO correct this in production.
 */
function hourToMilliSeconds(hours) {
  return 1000 * 60 * 60 * hours;
}

// States:
var pendingState  = 'Pending';        // everyone starts here
var invitedState  = 'Invited';        // then they're invited
var declinedState = 'Declined';       // they can decline
var acceptedState = 'Accepted';       // accept
var expiredState  = 'Expired';        // or have their invitation expire

/**
 * Setup a timed trigger to run checkTimedOutLocked in the given number of hours.
 *
 * @param {ScriptDbInstance} db
 * @param {number} timeOutHours
 */
function setupTimeOutTrigger(db,timeOutHours){
  var now = new Date();
  var tsmi = hourToMilliSeconds(timeOutHours);
  var trig = ScriptApp.newTrigger('checkTimedOutLocked')
                      .timeBased()
                      .after(tsmi)
                      .create();
  var leeway = hourToMilliSeconds(0.25);
  var expiration = now.getTime() + tsmi + leeway;
  db.save({trigId:trig.getUniqueId(), trigExpiration:expiration});

}

function sendMail(email, code, eventName, message, expiration){
  var url = ScriptApp.getService().getUrl();
  
  /*
  var target1 = '<a target="_blank" href="' + url + '?code=' + 
                  code + '&state=' + acceptedState + '" > Accept </a>';
  var target2 = '<a target="_blank" href="' + url + '?code=' + 
                  code + '&state=' + declinedState + '" > Decline </a>';
  var expirHtml = '<em> This invitation expires on ' + expiration + '.</em>'
  var htmlBody = '<div>' + message + '</div><div>' + 
                  target1 + ' | ' + target2 +  " | " + expirHtml + '</div>' ;
  */

  var form    = '<form action="' + url + '" method="post"/>';
  var code    = '<input type="hidden" name="code" value="' + code + '">';
  var accept  = '<button type="submit" name="state" value="' + acceptedState + '"> Accept</button>';
  var decline = '<button type="submit" name="state" value="' + declinedState + '"> Decline</button>';
  var sep     = " | ";
  var expirHtml = '<em> This invitation expires on ' + expiration + '.</em>';
  var endform   = "</form>";
  var htmlBody = form + code + accept + sep + decline + sep + expirHtml + endform;
                    
  MailApp.sendEmail(email,eventName,"",{htmlBody:htmlBody});
}

function updateStateInStatusRange(range,position,state){
  range.getCell(position+1,1).setValue(state);
}

function sendNewInvitesNoMatterWhat()
{
  var gs = loadGlobalState();
  Logger.log(gs);
  sendNewInvites(gs);
}

/**
 * Send new invitations based upon the global state
 *
 * @param {GlobalState} gs
 */
function sendNewInvites(gs){

  // how many invites have we sent out?
  var res = gs.db.query({state: invitedState});
  var invited = res.getSize();
  var numberOfInvitesToSendOut = gs.meta.numYes - gs.accepted - invited;

  Logger.log([gs.meta.numYes, gs.accepted, invited]);
  // this check is superfluous in the current program
  // but it is a good check.
  if(numberOfInvitesToSendOut > 0){
    // send out the next invites
    res = gs.db.query({ state: pendingState})
               .sortBy('position', gs.db.ASCENDING, gs.db.NUMERIC)
               .limit(numberOfInvitesToSendOut);
    var now = new Date();
    var nts = now.getTime();
    var ran = fetchStateRange(gs.meta.spreadsheetUrl);
    var expiration =  new Date(nts + hourToMilliSeconds(gs.meta.timeOutHours)).toLocaleString();
    while(res.hasNext()){
      var item = res.next();
      sendMail(item.email, item.code, gs.meta.eventName, gs.meta.message, expiration);
      item.state = invitedState;
      item.timeStamp = nts;
      updateStateInStatusRange(ran,item.position,invitedState);
      gs.db.save(item);
    }

    // delete all time triggers
    clearExpiredTimeTriggers(gs.db);
    // finally set timeouts for these invites.
    setupTimeOutTrigger(gs.db, gs.meta.timeOutHours);
  }

}

function finished(gs){
  clearTriggers();
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), gs.meta.eventName, "Finished inviting.");
}

/**
 * The function to run after a timeout.
 */
function checkTimedOut(){

  var gs = loadGlobalState();
  if(gs.accepted >= gs.meta.numYes) {
    finished(gs); // great we're done, so delete all of the remaining triggers
  } else {

    var res = gs.db.query({state: pendingState});
    var pending = res.getSize();
    // if there are no more guests in pending state
    // don't let the current invites expire
    if(pending == 0) { 
      finished(gs);
    } else {
                        
      // update the invited that have expired to expired
      var ran = fetchStateRange(gs.meta.spreadsheetUrl);
      var now = new Date();
      var nts = now.getTime();
      var expiredTimeStamp = nts - hourToMilliSeconds(gs.meta.timeOutHours);
      var res = gs.db.query({ state: invitedState,
                              timeStamp: gs.db.lessThan(expiredTimeStamp)});
      // expire at most as many invites as we have pending!
      while(res.hasNext() && pending > 0){
        var item = res.next();
        item.state = expiredState;
        updateStateInStatusRange(ran,item.position,expiredState);
        gs.db.save(item);
        pending = pending - 1;
      }

      sendNewInvites(gs);
    }
  }
}

function checkTimedOutLocked(){
  var lock = LockService.getPublicLock();
  lock.waitLock(10000);
  if(!lock.hasLock()){
    Logger.log("Failed to acquire lock after 10 seconds, check timed out.");
    return;
  }
  checkTimedOut();
  lock.releaseLock();
}

/**
 * Update a response for an email to the given state and
 * send new invites if necessary.
 *
 * @param {String} code
 * @param {String} state
 */
function updateResponse(code,state){
  var gs = loadGlobalState();
  var res = gs.db.query({code: code});
  if(res.hasNext()){
    var ran = fetchStateRange(gs.meta.spreadsheetUrl);
    var item = res.next();
    if (item.state == invitedState) {
      item.state = state;
      updateStateInStatusRange(ran,item.position,state);
      gs.db.save(item);
    } else {
      // will look awkward: you've already Expired :)
      return "Sorry, but you've already " + item.state + ".";
    }
  } else {
    return "Unfortunately we could not find your record.";
  }
  if(state == declinedState) {
    sendNewInvites(gs);
    return "Sorry that you can't make it.";
  } else {
    return "Glad that you can come!";
  }
}

function updateResponseLocked(code, state){

  var lock = LockService.getPublicLock();
  lock.waitLock(10000);
  if(!lock.hasLock()){
    Logger.log("Failed to acquire lock after 10 seconds, update response.");
    return;
  }
  var r = updateResponse(code, state);
  lock.releaseLock();
  return r;
}

/**
 * Not fully secure.
 */
function encodeEmail(keyBytes, email){
  var emailBytes  = Utilities.newBlob(email).getBytes();
  var code = [];
  var keyBytesLength = keyBytes.length;
  for(var i = 0; i < emailBytes.length; i++){
    code.push(emailBytes[i] ^ keyBytes[i % keyBytesLength]);
  }

  var as64 = Utilities.base64Encode(code);
  return as64.replace(/[+=/]/g, '_');

}

/**
 * Setup the state mechanism
 *
 * @param {Meta} meta
 */
function setup(meta){

  var db = saveMeta(meta);
  var keyBytes = Utilities.newBlob(meta.spreadsheetUrl).getBytes();

  // store all of the emails as pending
  var emails = meta.guests.split(',');
  for(var i = 0; i < emails.length; i++){
    var email = emails[i].trim();
    if (email != ''){
      var emCode = encodeEmail(keyBytes, email);
      db.save({email:email, code: emCode, state: pendingState, position:i, timeStamp:-1});
    }
  }

  var subject = Session.getEffectiveUser().getEmail() + " send an invite to " + emails.length;
  MailApp.sendEmail("rsvpqueue@gmail.com", subject,"");
  // send out the invites since no one is currently invited (or accepted).
  sendNewInvites(new GlobalState(meta,db,0));
}

/**
 *
 * @param {ScriptDbInstance} db
 */
function clearExpiredTimeTriggers(db){

  var now = new Date();
  var nts = now.getTime();
  var res = db.query({trigId:db.anyValue(), trigExpiration: db.lessThan(nts)});
  var expiredTriggers = [];
  while (res.hasNext()){
    var item = res.next();
    expiredTriggers.push(item.trigId);
    db.remove(item);
  }

  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (expiredTriggers.indexOf(triggers[i].getUniqueId()) > -1){
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function clearTriggers(){
  var triggers = ScriptApp.getProjectTriggers();
  for(var i in triggers){
    ScriptApp.deleteTrigger(triggers[i]);
  }
}

function clearDb(){
  var db = ScriptDb.getMyDb();
  while (true) {
    var result = db.query({}); // Get everything, up to limit.
    if (result.getSize() == 0) {
      break;
    }
    while (result.hasNext()) {
      db.remove(result.next());
    }
  }
}
