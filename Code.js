/**
 * The entry point of the script. First determine who is calling the application:
 * If it is the current user:
 *    For the time being if the user has no invites in progress then show input 
 *    html form found in the index file, otherwise just route them to the spreadsheet
 *    that keeps track of the currently running invite process.
 * If it is an anonymous user:
 *    Check if they have the correct response parameters
 */
function doGet(request) {
  // who's running the show
  var em = Session.getActiveUser().getEmail();
  if (em == Session.getEffectiveUser().getEmail()) {
    var meta = loadMeta();
    if(meta == null) {    // not running
      return HtmlService.createTemplateFromFile('index').evaluate();
    } else { 
      return HtmlService.createHtmlOutput(
        "<form action='" + meta.spreadsheetUrl + "' method='get' id='foo'></form>" + 
        "<script>document.getElementById('foo').submit();</script>"); 
    }
  } else {
    handleAnonymous(request);
  }
}

/**
 * A call back from the index page to handle submitting of the form
 *
 * @param {FormObject} formObject as gathered by the form in index.
 * @return {String} a url to the new Spreadsheet that one can use to keep track of
 *                  the invites.
 */
function processForm(formObject) {
  Logger.log(["formObject:", formObject]);
  return go(formObject);
}

/**
 * go
 */
function go(formObject){
  var url = createConfigSheet(formObject);    
  var allEmails = formObject.guests.split(',');
  var lb = Math.min(formObject.numYeses, 20);  // max number of triggers
  var firstEmails = allEmails.slice(0,lb);
  var restEmails = allEmails.slice(lb);
  setup(url, firstEmails, restEmails
          , formObject.eventName
          , formObject.message
          , formObject.timeToRespond
          , formObject.numYeses);
}
