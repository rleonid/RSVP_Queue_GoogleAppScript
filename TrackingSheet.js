/**
 * Create a spreadsheet to keep track of our invitation progress.
 */

/**
 * Setup RSVP sheet.
 *
 * @param {Sheet} sheet where to setup.
 * @param {FormObject} formObject an object with all of the relevant data.
 */
function setupConfigSheet(sheet,formObject){
  var configFont  = 'Verdana';
  var fontWeight  = 'bold';
  var fontLine    = 'underline';

  var headerRange = sheet.getRange(1,1,1,2);
  headerRange.setValues([['Guests','Status']]);
  headerRange.setFontFamilies([[configFont, configFont]]);
  headerRange.setFontWeights([[fontWeight, fontWeight]]);
  headerRange.setFontLines([[fontLine, fontLine]]);
  headerRange.setNotes([
      ["These are the people that we're going to try to invite.",
       "Once emails are sent and we process responses we'll update their status in the column below."]]);

  var guests = formObject.guests.split(",");
  var emailsRange = sheet.getRange(2,1,guests.length,1);
  emailsRange.setBackground('#33CC33');
  var guestsAs2dArr = [];
  for(var i = 0; i < guests.length; i++){
    guestsAs2dArr.push([guests[i]]);
  }
  emailsRange.setValues(guestsAs2dArr);
  sheet.setColumnWidth(1,160);

  var statusRange = sheet.getRange(2,2,guests.length,1);
  statusRange.setBackground('#CCCC00');
  statusRange.setFormula("R[0]C[-1]");
  sheet.setColumnWidth(2,80);

  var parameterRange = sheet.getRange(1,4,3,1);
  parameterRange.setValues([['Message:'],
                            ["Number of Yes's:"],
                            ["Time to respond:"]]);
  parameterRange.setFontFamilies([[configFont],[configFont],[configFont]]);
  parameterRange.setFontWeights([[fontWeight],[fontWeight],[fontWeight]]);
  parameterRange.setFontLines([[fontLine],[fontLine],[fontLine]]);

  sheet.setColumnWidth(4,150);
  //sheet.setColumnWidth(4, 135);  
  
  var parameterRange2 = sheet.getRange(1,5,3,1);
  parameterRange2.setNotes([['Enter the message (invitation) to send to your guests here.'],
                            ['How many guests do you want to invite?'],
                            ["How much time do you want to give guests to respond to your email? After this time we will invite the next person in the queue."]]);
  
  sheet.setColumnWidth(5,200);
  parameterRange2.setBackground('#33CC33');
  parameterRange2.setValues([[formObject.message],
                             [formObject.numYes],
                             [formObject.timeToRespond]]);
};

/**
 * Setup the config sheet.
 */
function createConfigSheet(formObject){
  var spreadS   = SpreadsheetApp.create("RSVP Responses" + formObject.eventName);
  var sheetName = "RSVPed";
  spreadS.renameActiveSheet(sheetName);
  var confSheet = spreadS.getSheetByName(sheetName);
  setupConfigSheet(confSheet,formObject);
  return spreadS.getUrl();
};
