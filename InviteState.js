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
  return 1000 * 60 * hours;    // add a *60 to really make this hours!
}

// States:
var pendingState  = 'Pending';        // everyone starts here
var invitedState  = 'Invited';        // then they're invited
var declinedState = 'Declined';       // they can decline
var acceptedState = 'Accepted';       // accept
var expiredState  = 'Expired';        // or have their invitation expire

/**
 * Setup a timed trigger to run checkTimedOut in the given number of hours.
 *
 * @param {number} timeOutHours
 */
function setupTimeOutTrigger(timeOutHours){
  ScriptApp.newTrigger('checkTimedOut')
           .timeBased()
           .after(hourToMilliSeconds(timeOutHours))
           .create();
}

function sendMail(email, eventName, message){
  var url = ScriptApp.getService().getUrl();
  var target1 = '<a target="_blank" href="' + url + '?email=' + 
                  email + '&state=' + acceptedState + '" > Accept </a>';
  var target2 = '<a target="_blank" href="' + url + '?email=' + 
                  email + '&state=' + declinedState + '" > Decline </a>';
  var htmlBody = '<div>' + message + '</div><div>' + 
                  target1 + ' | ' + target2 + '</div>';

  MailApp.sendEmail(email,eventName,"",{htmlBody:htmlBody});
}

function updateStateInStatusRange(range,position,state){
  range.getCell(position+1,1).setValue(state);
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
    while(res.hasNext()){
      var item = res.next();
      sendMail(item.email, gs.meta.eventName, gs.meta.message);
      item.state = invitedState;
      item.timeStamp = nts;
      updateStateInStatusRange(ran,item.position,invitedState);
      gs.db.save(item);
    }

    // finally set another timeout
    setupTimeOutTrigger(gs.meta.timeOutHours);
  }

}

/**
 * The function to run after a timeout.
 */
function checkTimedOut(){

  var gs = loadGlobalState();
  if(gs.accepted >= gs.meta.numYes) {
    clearTriggers(); // great we're done, so delete all of the remaining triggers
  } else {

    // update the invited that have expired to expired
    var ran = fetchStateRange(gs.meta.spreadsheetUrl);
    var now = new Date();
    var nts = now.getTime();
    var expiredTimeStamp = nts - hourToMilliSeconds(gs.meta.timeOutHours);
    var res = gs.db.query({ state: invitedState,
                            timeStamp: gs.db.lessThan(expiredTimeStamp)});
    while(res.hasNext()){
      var item = res.next();
      item.state = expiredState;
      updateStateInStatusRange(ran,item.position,expiredState);
      gs.db.save(item);
    }

    sendNewInvites(gs);
  }

}

/**
 * Update a response for an email to the given state and
 * send new invites if necessary.
 *
 * @param {String} email
 * @param {String} state
 */
function updateResponse(email,state){
  var gs = loadGlobalState();
  var ran = fetchStateRange(gs.meta.spreadsheetUrl);
  var res = gs.db.query({email: email});
  while(res.hasNext()){
    var item = res.next();
    item.state = state;
    updateStateInStatusRange(ran,item.position,state);
    gs.db.save(item);
  }
  if (state == declinedState){
    sendNewInvites(gs);
  }
}

/**
 * Setup the state mechanism
 *
 * @param {Meta} meta
 */
function setup(meta){

  var db = saveMeta(meta);
  var emails = meta.guests.split(',');

  // store all of the emails as pending
  for(var i = 0; i < emails.length; i++){
    db.save({email:emails[i], state: pendingState, position:i, timeStamp:-1});
  }

  // send out the invites since no one is currently invited (or accepted).
  sendNewInvites(new GlobalState(meta,db,0));

  // set a timeout
  setupTimeOutTrigger(meta.timeOutHours);
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
