function run(){
var url ='someurl';
var headers = new Array();
headers['Content-type'] = 'application/json';
var result = nlapiRequestURL(url, null, headers);
var result = result.getBody();
var output = new Array();

return result;
}; 

