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
    var template = HtmlService.createTemplateFromFile('index');
    template.meta = meta;
    return template.evaluate();
  } else {
    return handleAnonymous(request);
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
  var url = createConfigSheet(formObject); 
  var m  = new Meta(url, formObject.guests
                       , formObject.eventName
                       , formObject.message
                       , formObject.timeToRespond
                       , formObject.numYes);

  setup(m);
}

/**
 * What happens when an anonymous user makes a request to the app.
 * Either it is someone we don't trust, in which case ignore
 * Or it is a response from one of our emails in which case we need to
 * record the response.
 */
function handleAnonymous(request){
  Logger.log(["anonymous request:", request]);
  if(request.parameter === undefined){ 
    return HtmlService.createHtmlOutput("<b>You must be mistaken.</b>");
  } else {
    if(request.parameter.code === undefined ||
       request.parameter.state === undefined){
      return HtmlService.createHtmlOutput("<b>Missing parameters.</b>");
    } else {
      updateResponse(request.parameter.code,request.parameter.state);
      if(state == declinedState) {
        return HtmlService.createHtmlOutput("<b>Sorry that you can't make it.</b>");
      } else {
        return HtmlService.createHtmlOutput("<b>Glad that you can come!</b>");
      }
    }

  }
}

function clearRSVP(){
  clearTriggers();
  clearDb();
}
