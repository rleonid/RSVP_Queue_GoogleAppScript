// File Config.js
// Old version of some logic to create the config sheet,
// not used in the project anymore.

/**
 * What we need to create a configuration sheet.
 */

var baseName = "RSVP Config";

/**
 * Given a spreadsheet find the first sheet name that we can
 * use for configuration.
 *
 * @param {Spreadsheet} spreadsheet Where to look.
 */
function freeConfigSheetName(spreadsheet){
  var name = baseName;
  Logger.log(spreadsheet);
  var sheet = spreadsheet.getSheetByName(baseName);
  if(sheet == null){    // great it's free
      return baseName;
  } else {
    var counter = 0;
    do {
      counter += 1;
      name = baseName + counter;
      sheet = spreadsheet.getSheetByName(name);
    }
    while(sheet != null)
  }
  return name; 
};

/**
 * Where are the parameters stored?
 */
function getParameterRange(sheet){
  return sheet.getRange(1,5,3,1);
}

/**
 * Setup config sheet.
 *
 * @param {Sheet} sheet where to setup configuratio  template.
 */
function setupConfigSheet(sheet){
  var configFont  = 'Verdana';
  var fontWeight  = 'bold';
  var fontLine    = 'underline';

  var headerRange = sheet.getRange(1,1,1,2);
  headerRange.setValues([['Guests','Status']]);
  headerRange.setFontFamilies([[configFont, configFont]]);
  headerRange.setFontWeights([[fontWeight, fontWeight]]);
  headerRange.setFontLines([[fontLine, fontLine]]);
  headerRange.setNotes([
      ["Enter the email addresses of people you want to invite in this column, starting at A2",
       "Once emails are sent and we process responses we'll update their status in the column below."]]);

  var maxNumRows = 99;
  var emailsRange = sheet.getRange(2,1,maxNumRows,1);
  emailsRange.setBackground('#33CC33');
  sheet.setColumnWidth(1,160);

  var statusRange = sheet.getRange(2,2,maxNumRows,1);
  statusRange.setBackground('#CCCC00');
  sheet.setColumnWidth(2,80);

  var paraLabelRange = sheet.getRange(1,4,3,1);
  paraLabelRange.setValues([['Message:'],
                            ["Number of Yes's:"],
                            ["Time to respond:"]]);
  paraLabelRange.setFontFamilies([[configFont],[configFont],[configFont]]);
  paraLabelRange.setFontWeights([[fontWeight],[fontWeight],[fontWeight]]);
  paraLabelRange.setFontLines([[fontLine],[fontLine],[fontLine]]);

  sheet.setColumnWidth(4,150);
  //sheet.setColumnWidth(4, 135);  
  
  var parameterRange = getParameterRange(sheet);
  parameterRange.setNotes([['Enter the message (invitation) to send to your guests here.'],
                            ['How many guests do you want to invite?'],
                            ["How much time do you want to give guests to respond to your email? After this time we will invite the next person in the queue."]]);

  sheet.setColumnWidth(5,200);
  parameterRange.setBackground('#33CC33');

};

/**
 * Setup the config sheet.
 */
function createConfigSheet(sheet){
  var spreadS   = SpreadsheetApp.getActive();     
  var freeName  = freeConfigSheetName(spreadS);
  var confSheet = spreadS.insertSheet(freeName);
  setupConfigSheet(confSheet);
};

/*
 * Statuses:
 * Empty ie "" ->
 * Invitation Sent -> Declined
 *                 |  Timed-out
 *                 |  Yes
 */
function processedState(state){
  return state == "Declined" || state == "Timed out" || state == "Yes";
}

/**
 * Free emails do not have a status.
 *
 * @param {Sheet} sheet Free emails.
 */
/*
function freeEmails(sheet){
  var emailValues = sheet.getRange('A:B').getValues();
  var returnMe = [];
  for(int r = 0; r < emailValues.length; r++){
    if (emailValues[r][0] == "") {
      return returnMe;               // done scanning!
    } else if (emailValues[r][1] == "") {   // empty state
      returnMe.push([emailValues[r][0], r]);
    } else
    if (processedState(emailValues[r][1])) {
      // do nothing good.
    }

  }
}
*/

function getState(emailText){
  var db = ScriptDb.getMyDb();
  var res = db.query({email:emailText});
  if(res.hasNext()){
    var pair = res.next();
    return pair.state;
  } else {
    return "";
  }
}

function setState(emailText, stateText){
  var db = ScriptDb.getMyDb();
  var res = db.query({email:emailText});
  while(res.hasNext()){
    db.remove(res.next());
  } 
  db.save({email:emailText, state: stateText});
}

/**
 *
 * @param {Sheet} sheet Create an object describing the
 * status of the RSVP system.
 */
function figureOutStatus(sheet){
  var parameters = getParameterRange(sheet);
  var state = {
      'message' : parameters[0],
      'numberOfYes' : parameters[1],
      'delay' : parameters[2],
      '
  
}




