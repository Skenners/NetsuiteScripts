function run(){
var url ='https://www.dickerdata.com.au/ExportService.aspx?Export=DataFeedJSON';
var headers = new Array();
headers['Content-type'] = 'application/json';
var result = nlapiRequestURL(url, null, headers);
var result = result.getBody();
var output = new Array();

return result;
}; 

