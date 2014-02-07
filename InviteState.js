/**
 * What is the state of this email address, ex has it confirmed a reservation?
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
};

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
 * Return the URL of a Google Spreadsheet that keeps track of running invites
 * that are associated with this script. This is how to effectively determine
 * if invites are in progress.
 *
 * @return {String} Empty string return if no url. 
 */
function spreadSheetUrl(){
  var db = ScriptDb.getMyDb();
  var res = db.query({spreadsheetUrl: db.anyValue()});
  if(res.hasNext()){
    return res.next();
  } else {
    return "";
  }
}

/**
 * Save the meta data associated with url.
 *
 * @param {String} url
 */
function saveMeta(url, eventName, message, timeOutHours, numYes){
  var db = ScriptDb.getMyDb();
  db.save({ spreadsheetUrl:url
          , eventName:eventName
          , message:message
          , timeOutHours:timeOutHours,
          , numYes:numYes});
  return db;
}

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
 * TODO
 */
function hourToMilliSeconds(hours) {
  return 1000 * 60 * hours;    // add a *60 to really make this hours!
}

// States:
var invitedState  = 'Invited';
var pendingState  = 'Pending';
var declindeState = 'Declined';
var acceptedState = 'Accepted';
var expiredState  = 'Expired';

function checkTimedOut(){
  var meta = loadMeta();
  var db = ScriptDb.getMyDb();
  // how many people have accepted?
  var res = db.query({state: acceptedState});
  var accepted = res.getSize();
  if(accepted >= meta.numYes) { // great we're done!
    return;
  } else {

    // update the invited that have expired to expired
    var now = new Date();
    var nts = now.getTime();
    var expiredTimeStamp = nts - hourToMilliSeconds(meta.timeOutHours);
    res = db.query({ state: invitedState, timeStamp: db.lessThan(expiredTimeStamp)});
    while(res.hasNext()){
      var item = res.next();
      item.state = expiredState;
      db.save(item);
    }

    // send out the next invites
    res = db.query({ state: pendingState})
            .sortBy('position', db.ASCENDING, db.NUMERIC)
            .limit(meta.numYes - accepted);
    while(res.hasNext()){
      var item = res.next();
      MailApp.sendEmail(item.email, meta.eventName, meta.message); // send email
      item.state = invitedState;
      item.timeStamp = nts;
      db.save(item);
    }

    // finally set another timeout
    ScriptApp.newTrigger('checkTimedOut')
    .timeBased()
    .after(hourToMilliSeconds(meta.timeOutHours)
    .create();
  }

};

function setup(url,firstEmails,restEmails,eventName,message,timeOutHours,numYes){
  var db = saveMeta(url, eventName, message, timeOutHours, numYes){
  var now = new Date();
  var ts = now.getTime();
  for(int i = 0; i < firstEmails.length; i++){
    var mailMe = firstEmail[i];
    MailApp.sendEmail(mailMe, eventName, message); // send email
    db.save({email:mailMe, state: invitedState, position:-1, timeStamp:ts});
  }

  // store the rest of the emails for processing
  for(int i = 0; i < restEmails.lengthl i++){
    db.save({email:restEmails[i], state: pendingState, position:i, timeStamp:-1});
  }

  // set a timeout 
  ScriptApp.newTrigger('checkTimedOut')
    .timeBased()
    .after(hourToMilliSeconds(timeOutHours)
    .create();

}
