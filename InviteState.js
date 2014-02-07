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
 * @param {String} eventName 
 * @param {String} message
 * @param {number} timeOutHours 
 * @param {number} numyes 
 */
function Meta(url, eventName, message, timeOutHours, numYes){
  this.spreadsheetUrl = url;
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
  db.save(m);
  return db;
}

/**
 * Load the meta data associated with the invite queue.
*
 * @return {Meta} meta 
 */
function loadMeta(){
  var db = ScriptDb.getMyDb();
  var res = db.query({ spreadsheetUrl: db.anyValue()
                     , eventName: db.anyValue()
                     , message: db.anyValue()
                     , timeOutHours: db.anyValue()
                     , numYes: db.anyValue() });
  if (res.hasNext()){
    return res.next();
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
  return GlobalState(meta, db, accepted);
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
  var target1 = '<a target=\"_blank\" href=\"' + url + '?email=' + 
                  email + '&state=' + acceptedState + '\" > Accept </a>';
  var target2 = '<a target=\"_blank\" href=\"' + url + '?email=' + 
                  email + '&state=' + declinedState + '\" > Decline </a>';
  var htmlBody = '<div>' + message + '</div><div>' + 
                  target1 + ' | ' + target2 + '</div>';

  MailApp.sendEmail(email,eventName,"",{htmlBody:htmlBody});
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
    while(res.hasNext()){
      var item = res.next();
      sendMail(item.email, gs.meta.eventName, gs.meta.message);
      item.state = invitedState;
      item.timeStamp = nts;
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
    // great we're done, so delete all of the remaining triggers
    var triggers = ScriptApp.getProjectTriggers();
    for(var i in triggers){
      ScriptApp.deleteTrigger(triggers[i]);
    }
  
    return;
  } else {

    // update the invited that have expired to expired
    var now = new Date();
    var nts = now.getTime();
    var expiredTimeStamp = nts - hourToMilliSeconds(gs.meta.timeOutHours);
    var res = gs.db.query({ state: invitedState,
                            timeStamp: gs.db.lessThan(expiredTimeStamp)});
    while(res.hasNext()){
      var item = res.next();
      item.state = expiredState;
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
  var res = gs.db.query({email: email});
  while(res.hasNext()){
    var item = res.next();
    item.state = state;
    gs.db.save(item);
  }
  if (state == declinedState){
    sendNewInvites(gs);
  }
}

/**
 * Setup the state mechanism
 */
function setup(url,emails,eventName,message,timeOutHours,numYes){

  var m  = Meta(url, eventName, message, timeOutHours, numYes);
  var db = saveMeta(m);
  // store all of the emails as pending
  for(var i = 0; i < emails.length; i++){
    db.save({email:emails[i], state: pendingState, position:i, timeStamp:-1});
  }

  // send out the invites since no one is currently invited (or accepted).
  sendNewInvites(GlobalState(m,db,0));

  // set a timeout
  setupTimeOutTrigger(timeOutHours)
}


