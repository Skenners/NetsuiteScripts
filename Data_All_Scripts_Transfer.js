/*
* Created By Rick Jones, 2016
*
*
* This script handles the incoming data from in json/application format. 
* The data is processed here to be placed into a custom record (customrecord_dd_update), 
* filtering by inactivating the fields you dont wish to update using the map variable below.
*
* Due to Netsuites Governancing of how many iterations you can provide, multiple calls to the script are required until its completed.
* With this in mind, scripts are checked repeatedly for governance compliance and rescheduling the scripts completed. 
*
* The variables below can be altered to suit your needs.
*
* VendorIgnore : Used to Ignore vendors from being put into the database as requested
* map : the mapping for the JSON input coming in
* defaultValues : default values that go into the serialized inventory item
* GetJSON : Gets the JSON from the Site using runGetJSON()
* AddToCustomRecord : Adds the JSON data into the Custom Record Staging Record
* PostDeleteCustomRecords : Deletes the Custom Data Staging Records after the process has completed
* ProcessIntoItems : Processes the in the Staging Area and converts to Serialized Inventory Items
*
* Each Script is in a chain and runs the next part of the process by scheduling it. It only schedules the next script after the data has been completely done.
*/

// add in the vendor names in the array. eg. "vendorname": ["Lenovo", "IBM"]
var VendorIgnore = {
	"vendorname": []
};


// name : { custom record name, item name, transfer this data? true/false }
var map = {
	"StockCode" : ["custrecord_stockcode", "itemvendor_vendorcode", true],
	"Vendor" : ["custrecord_vendor", "manufacturer", true],	
	"VendorStockCode1" : ["custrecord_vendorstockcode", "mpn",true],
	"VendorStockCode2" : ["custrecord_vendorstockcode", "itemid",true],
	"VendorStockCode3" : ["custrecord_vendorstockcode", "upccode",true],
	"VendorStockCode4" : ["custrecord_vendorstockcode", "displayname",true],
	"StockDescription1" : ["custrecord_stockdescription", "purchasedescription",true],
	"StockDescription2" : ["custrecord_stockdescription", "salesdescription",true],
	"PrimaryCategory" : ["custrecord_primarycategory", "custitemprimcat",true],
	"SecondaryCategory" : ["custrecord_secondarycategory", "custitemseccat",true],
	"TertiaryCategory" : ["custrecord_tertiarycategory", "custitemtertcat",true],
	"RRPEx" : ["custrecord_rrpex", "price1",true],
	"DealerEx1" : ["custrecord_dealerex", "cost",true],
    "DealerEx2" : ["custrecord_dealerex", "costestimate",true],
	"StockAvailable" : ["custrecord_stockavailable", "",true],
	"ETA" : ["custrecord_eta", "custitemitemeta",true],
	"Status" : ["custrecord_status", "",true],
	"Type" : ["custrecord_type", "",true],
	"BundledItem1" : ["custrecord_bundleditem1", "",true],
	"BundledItem2" : ["custrecord_bundleditem2", "",true],
	"BundledItem3" : ["custrecord_bundleditem3", "",true],
	"BundledItem4" : ["custrecord_bundleditem4", "",true],
	"BundledItem5" : ["custrecord_bundleditem5", "",true]
};

// these values are defaulted values that are required to update within the new serialised item as well as item lists.
var defaultValues = {
	"costestimatetype" : ["costestimatetype", "PURCHORDERRATE", true],
	"cogsaccount" : ["cogsaccount",182, true],
	"assetaccount" : ["assetaccount",124, true],
	"incomeaccount" : ["incomeaccount",174, true],
	"purchasetaxcode" : ["purchasetaxcode",5, true],
	"salestaxcode" : ["salestaxcode",5, true],
	"department" : ["department",19, true],
	"class" : ["class",22, true],
	"vendor" : ["itemvendor.vendor",1540, true],
	"vendorcurrency" : ["itemvendorpricelines.vendorcurrency",1, true]
};


// These variables will switch on and off the various programs that are in runscript. Eg// if you already have the latest copy of the data in the
// custom record, you can set GETJSON, DeleteCustomRecords and AddToCustomRecord to false, so it doesnt run that data again, which can take up time.

var GetJSON = true;
var AddToCustomRecord = true;
var PostDeleteCustomRecords = true;
var ProcessIntoItems = true;

/*
* ScriptRunning is a boolean true/false/null to see if this has already been run and is running the remainder of the script for processing
*/



function runScript() {
	//this will run the linked scripts and is the first to run.
		
	try {
		if(GetJSON) {
			//calls the GetJSON script deployment (runGetJSON)
			nlapiScheduleScript('customscript_dd_get_json', 'customdeploy_dd_get_json_dp', null);	
		}
	}
	catch(err) {
				var str = '';
				if( err instanceof nlobjError ) {
					var txt = 'ERROR CODE: ' + err.getCode() + '\n ERROR DETAILS: '+ err.getDetails() + '\n ERROR STACK: ' + err.getStackTrace().join(', ');
					if(datain)
						{
						txt = txt + '\n\n datain: ' + JSON.stringify(datain); 
						str = 'NS ERROR: runScript()::\n\n datain: true :: ' + txt;
						}
					else {
						str = 'NS ERROR: runScript()::\n\n datain: false :: ' + txt;
						}
					nlapiLogExecution('ERROR','runScript() error.', txt);
					} 
				else {
					str = 'JS ERROR: runScript():: \n\n' + err.toString();	
					nlapiLogExecution( 'DEBUG', 'runScript() error.', str);
				}
				return str;
			}
}


function delete_records() {
	try {
		//This function runs deletes over every record in the custom record, one by one. when it runs out of usage, it reschedules itself to continue on
		//until completed. This is run at the end of the process.
		
		nlapiLogExecution('DEBUG', 'delete_records() LOG', 'Deleting Existing Data' );
		//Load a saved search that only finds the internal id's of everything in the record
		var filters = new Array();
        filters[0] = new nlobjSearchFilter('custrecord_updated' , null, 'is', "T" );
		var columns = new Array();
		columns[0] = new nlobjSearchColumn('internalid');
		var maxResults = nlapiSearchRecord('customrecord_ dd_update', null, filters, columns);
		
		//for each result thats returned from the search, go through and delete it.

		if(maxResults) {
			for(i=0; i < maxResults.length; i++){
				
				usage = nlapiGetContext().getRemainingUsage();
				if (usage < 1000) {
					nlapiScheduleScript('customscript_dd_inbound_delete_all', 'customdeploy_dd_inbound_delete_all_dp', null);	
					nlapiLogExecution('DEBUG', 'delete_records() LOG', 'Data Deleted, Scheduled Script for more deletes' );
					break;
				}
				nlapiDeleteRecord('customrecord_ dd_update', maxResults[i].getValue('internalid') );
			}
		nlapiLogExecution('DEBUG', 'delete_records() LOG', 'Loop Completed Data' );
		}

		maxResults = nlapiSearchRecord('customrecord_ dd_update', null, null, columns);
		if(!maxResults) {
			nlapiLogExecution('DEBUG', 'delete_records() LOG', 'Existing Data Deleted' );
		}
		else {
			nlapiScheduleScript('customscript_dd_inbound_delete_all', 'customdeploy_dd_inbound_delete_all_dp', null);	
			nlapiLogExecution('DEBUG', 'delete_records() LOG', 'Data Deleted, Scheduled Script for more deletes' );
		}
		return true;
	}
	catch(err) {
		var str = '';
		if( err instanceof nlobjError ) {
			var txt = 'ERROR CODE: ' + err.getCode() + '\n ERROR DETAILS: '+ err.getDetails() + '\n ERROR STACK: ' + err.getStackTrace().join(', ');
			str = 'NS ERROR: delete_records()::\n\n datain: true :: ' + txt;
			nlapiLogExecution('ERROR','delete_records() error.', txt);
			} 
		else {
			str = 'JS ERROR: delete_records():: \n\n' + err.toString();
			nlapiLogExecution( 'DEBUG', 'delete_records() error.', str);
		}
		return str;
	}
}


function runGetJSON(){
	//this function gets the json using netsuites nlapirequesturl with post. It streams it in via json and is parsed.
	//after it is collected and parsed, it is sent to the add to custom records function for processing into netsuite.
	
	if(GetJSON) {
		var url = "SOMESITE.JSON.DATA"; //Site removed for privacy
		var headers = {"Content-Type": "application/json"};
		nlapiLogExecution('DEBUG', 'runGetJSON() LOG', 'Requesting JSON Data' );
		var response = nlapiRequestURL(url, "", headers, "POST");
		var data = JSON.parse(response.getBody());
		nlapiLogExecution('DEBUG', 'runGetJSON() LOG', 'JSON Data Received. ' + ' :: Records: ' + data.length );
	}
	
	if(AddToCustomRecord) {
		nlapiLogExecution('DEBUG', 'runGetJSON() LOG', 'Data Received For Processing. Creating Scheduled Scripts.' );
		var params = {
			custscript_dd_datain: JSON.stringify(data),
			custscript_dd_fromcount: 0,
			custscript_dd_tocount: data.length
		};
		//calls the GetJSON script deployment (runGetJSON)
		nlapiScheduleScript('customscript_dd_process_json', 'customdeploy_dd_process_json_dp', params);					
		nlapiLogExecution('DEBUG', 'runGetJSON() LOG', 'Initial Scheduled Script Created' );
	}		
	return true;
}

function alreadyinnetsuite(checkstr) {
	//if its already in the custom record or not
	var filters = new Array();
	filters[0] = new nlobjSearchFilter( 'custrecord_vendorstockcode', null, 'is', checkstr );
	var columns = new Array();
	columns[0] = new nlobjSearchColumn('internalid');
	var maxResults = nlapiSearchRecord('customrecord_ dd_update', null, filters, columns);

	if(maxResults) {
		return true;
	}
	else {
		return false;
	}
}

function ProcessDataInArray() {
	try {
		//this function processes all the json data by getting it sent through from the previous script. As it is a new script, it has new governance and starts
		//again. When run out, it reschedules itself to run.
		var datain;
		var countTotal = 0;
		
		//get the parameters
		if(nlapiGetContext().getSetting('SCRIPT','custscript_dd_datain')) {
			datain = JSON.parse(nlapiGetContext().getSetting('SCRIPT','custscript_dd_datain'));
		}
		nlapiLogExecution('DEBUG', 'ProcessDataInArray() LOG', 'JSON Data Received. Processing into Custom Record. Records: ' + datain.length );

		var count = 0;
		var record;
		var VendorIgnoreBool = false;
		var usage = nlapiGetContext().getRemainingUsage();
		
		do {
			usage = nlapiGetContext().getRemainingUsage();
			if (usage < 1000) {
				nlapiLogExecution('DEBUG', 'runScript() LOG', 'Creating Scheduled Scripts.' );
				var params = {
					custscript_dd_datain: JSON.stringify(datain),
					custscript_dd_fromcount: 0,
					custscript_dd_tocount: datain.length
				};
				nlapiScheduleScript('customscript_dd_process_json', 'customdeploy_dd_process_json_dp', params);	
				nlapiLogExecution('DEBUG', 'runScript() LOG', 'New Scheduled Script Created to Continue Processing' );
				break;
			}
			if(VendorIgnore.vendorname) {
				for(i=0; i < VendorIgnore.vendorname.length;i++) {
					if(VendorIgnore.vendorname[i] == datain[count].Vendor){
						VendorIgnoreBool = true;
					}
				}
			}
			if(VendorIgnoreBool == false) {
				if(!alreadyinnetsuite(datain[count].VendorStockCode)) {
					record = nlapiCreateRecord('customrecord_ dd_update');
					if(map.StockCode[2] == true) {record.setFieldValue(map.StockCode[0], datain[count].StockCode);}
					if(map.Vendor[2] == true) {record.setFieldValue(map.Vendor[0], datain[count].Vendor);}
					if(map.VendorStockCode1[2] == true || map.VendorStockCode2[2] == true || map.VendorStockCode3[2] == true || map.VendorStockCode4[2] == true) {record.setFieldValue(map.VendorStockCode1[0], datain[count].VendorStockCode);}
					if(map.StockDescription1[2] == true || map.StockDescription2[2] == true) {record.setFieldValue(map.StockDescription1[0], datain[count].StockDescription);}
					if(map.PrimaryCategory[2] == true) {record.setFieldValue(map.PrimaryCategory[0], datain[count].PrimaryCategory);}
					if(map.SecondaryCategory[2] == true) {record.setFieldValue(map.SecondaryCategory[0], datain[count].SecondaryCategory);}
					if(map.TertiaryCategory[2] == true) {record.setFieldValue(map.TertiaryCategory[0], datain[count].TertiaryCategory);}
					if(map.RRPEx[2] == true) {record.setFieldValue(map.RRPEx[0], stripChars(datain[count].RRPEx));}
					if(map.DealerEx1[2] == true || map.DealerEx2[2] == true) {record.setFieldValue(map.DealerEx1[0], stripChars(datain[count].DealerEx));}
					if(map.StockAvailable[2] == true) {record.setFieldValue(map.StockAvailable[0], datain[count].StockAvailable);}
					if(map.ETA[2] == true) {record.setFieldValue(map.ETA[0], datain[count].ETA);}
					if(map.Status[2] == true) {record.setFieldValue(map.Status[0], datain[count].Status);}
					if(map.Type[2] == true) {record.setFieldValue(map.Type[0], datain[count].Type);}
					if(map.BundledItem1[2] == true) {record.setFieldValue(map.BundledItem1[0], datain[count].BundledItem1);}
					if(map.BundledItem2[2] == true) {record.setFieldValue(map.BundledItem2[0], datain[count].BundledItem2);}
					if(map.BundledItem3[2] == true) {record.setFieldValue(map.BundledItem3[0], datain[count].BundledItem3);}
					if(map.BundledItem4[2] == true) {record.setFieldValue(map.BundledItem4[0], datain[count].BundledItem4);}
					if(map.BundledItem5[2] == true) {record.setFieldValue(map.BundledItem5[0], datain[count].BundledItem5);}
					countTotal = countTotal + 1;
					nlapiSubmitRecord(record);
					record = null;
				}
			}
			
			datain.shift();
		}
		while(datain.length != 0);
		nlapiLogExecution('DEBUG', 'ProcessDataInArray() LOG', 'JSON Data Added' );
		if(datain.length < 0) {
			if(ProcessIntoItems) {
				nlapiScheduleScript('customscript_dd_inbound_is_serial_chk', 'customdeploy_dd_inbound_is_serial_chk_dp', null);						
				nlapiLogExecution('DEBUG', 'ProcessDataInArray() LOG', 'Deploying Serialized Item Script' );
			}
		}
		
		return true;  
	}
	catch(err) {
			var str = '';
			if( err instanceof nlobjError ) {
				var txt = 'ERROR CODE: ' + err.getCode() + '\n ERROR DETAILS: '+ err.getDetails() + '\n ERROR STACK: ' + err.getStackTrace().join(', ');
				if(datain)
					{
					txt = txt + '\n\n datain: ' + JSON.stringify(datain); 
					str = 'NS ERROR: ProcessDataInArray()::\n\n datain: true :: ' + txt;
					}
				else {
					str = 'NS ERROR: ProcessDataInArray()::\n\n datain: false :: ' + txt;
					}
				nlapiLogExecution('ERROR','ProcessDataInArray() error.', txt);
				} 
			else {
				str = 'JS ERROR: ProcessDataInArray():: \n\n' + err.toString();
				nlapiLogExecution( 'DEBUG', 'ProcessDataInArray() error.', str);
			}
			return false;
		}
}


function isSerialised(){
	try {
		//this function takes the data via saved searches and processes them as serialized inventory items.
		// it also checks to see if they exists, and if so (and arent serialized already) retired and new record created.
		
		nlapiLogExecution('DEBUG', 'isSerialised() LOG', 'Running Serialised Item Check' );

		var recordsupdated = 0;
		var usage;
		var filters = new Array();
		filters[0] = new nlobjSearchFilter('custrecord_vendorstockcode' , null, 'isnotempty', null );
		filters[1] = new nlobjSearchFilter('custrecord_updated' , null, 'is', "F" );
		
		var columns = new Array();
		columns[0] = new nlobjSearchColumn('internalid');
		columns[1] = new nlobjSearchColumn(map.StockCode[0]);
		columns[2] = new nlobjSearchColumn(map.Vendor[0]);
		columns[3] = new nlobjSearchColumn(map.VendorStockCode1[0]);
		columns[4] = new nlobjSearchColumn(map.StockDescription1[0]);
		columns[5] = new nlobjSearchColumn(map.PrimaryCategory[0]);
		columns[6] = new nlobjSearchColumn(map.SecondaryCategory[0]);
		columns[7] = new nlobjSearchColumn(map.TertiaryCategory[0]);
		columns[8] = new nlobjSearchColumn(map.RRPEx[0]);
		columns[9] = new nlobjSearchColumn(map.DealerEx1[0]);
		columns[10] = new nlobjSearchColumn(map.StockAvailable[0]);
		columns[11] = new nlobjSearchColumn(map.ETA[0]);
		columns[12] = new nlobjSearchColumn(map.Status[0]);
		columns[13] = new nlobjSearchColumn(map.Type[0]);
		columns[14] = new nlobjSearchColumn(map.BundledItem1[0]);
		columns[15] = new nlobjSearchColumn(map.BundledItem2[0]);
		columns[16] = new nlobjSearchColumn(map.BundledItem3[0]);
		columns[17] = new nlobjSearchColumn(map.BundledItem4[0]);
		columns[18] = new nlobjSearchColumn(map.BundledItem5[0]);
		// the saved search only processes 1000 at a time. Taking the first and comparing it to all the data in items.
		
		var maxResults = nlapiSearchRecord('customrecord_ dd_update', null, filters, columns);
		
		nlapiLogExecution('DEBUG','isSerialised() LOG', 'maxResults length: ' + maxResults.length);		
		for(i=0; i < maxResults.length; i++){
          nlapiLogExecution('DEBUG','isSerialised() LOG', 'maxResults InternalID: ' + maxResults[i].getValue('internalid'));
			usage = nlapiGetContext().getRemainingUsage();
			if (usage < 1000) {
				nlapiScheduleScript('customscript_dd_inbound_is_serial_chk', 'customdeploy_dd_inbound_is_serial_chk_dp', null);	
				nlapiLogExecution('DEBUG', 'isSerialised() LOG', 'Records Updated, Scheduled Script for more Updates' );
				return true;
			}
			
            
			var filters2 = new Array();
			filters2[0] = new nlobjSearchFilter('itemid' , null, 'is', maxResults[i].getValue(map.VendorStockCode1[0]) );
            filters2[1] = new nlobjSearchFilter('isinactive',null,'is','F');
			var cols = new Array();
			cols[0] = new nlobjSearchColumn('internalid');
			cols[1] = new nlobjSearchColumn('itemid');
			var notserialised = nlapiSearchRecord('item', null, filters2, cols);	
			
			if(notserialised) {
				if(notserialised[0].getRecordType() != 'serializedinventoryitem'){
                  nlapiLogExecution('DEBUG','isSerialised() LOG', 'notserialised internalid: ' + notserialised[0].getValue('internalid'));
					// change the item to inactive and add on _retired to the name
					record = nlapiLoadRecord(notserialised[0].getRecordType(), notserialised[0].getValue('internalid'));
					record.setFieldValue('itemid', notserialised[0].getValue('itemid') + "_retired"); //this gets the name and adds retired to it
					record.setFieldValue('isinactive', 'T'); // makes the record inactive
					nlapiSubmitRecord(record);
					
					// create the serialised item with data
					record = nlapiCreateRecord('serializedinventoryitem');
				}
				else {	
					//update data in the serialised item
                    var filters3 = new Array();
                    filters3[0] = new nlobjSearchFilter('itemid' , null, 'is', maxResults[i].getValue(map.VendorStockCode1[0]));
                    filters3[1] = new nlobjSearchFilter('isinactive',null,'is','F');
                    var serialisedcols = new Array();
                    serialisedcols[0] = new nlobjSearchColumn('internalid');
                    serialisedcols[1] = new nlobjSearchColumn('itemid');
                    serialisedcols[2] = new nlobjSearchColumn('vendor');
                    var serialised = nlapiSearchRecord('serializedinventoryitem', null, filters3, serialisedcols);	

                    if(serialised){
                        //update data in the serialised item
                        nlapiLogExecution('DEBUG','isSerialised() LOG', 'from not serialized, serialised internalid: ' + serialised[0].getValue('internalid'));
                        record = nlapiLoadRecord('serializedinventoryitem', serialised[0].getValue('internalid'));
                    } else {					
                        //create new record
                        // create the serialised item with data
                        nlapiLogExecution('DEBUG','isSerialised() LOG', 'new serialized item from not serialized search');
                        record = nlapiCreateRecord('serializedinventoryitem');
                    }
                  }
			} else {
				//check for being serialised
				var filters3 = new Array();
				filters3[0] = new nlobjSearchFilter('itemid' , null, 'is', maxResults[i].getValue(map.VendorStockCode1[0]));
                filters3[1] = new nlobjSearchFilter('isinactive',null,'is','F');
				var serialisedcols = new Array();
				serialisedcols[0] = new nlobjSearchColumn('internalid');
				serialisedcols[1] = new nlobjSearchColumn('itemid');
				serialisedcols[2] = new nlobjSearchColumn('vendor');
				var serialised = nlapiSearchRecord('serializedinventoryitem', null, filters3, serialisedcols);	
				
				if(serialised){
					//update data in the serialised item
                    nlapiLogExecution('DEBUG','isSerialised() LOG', 'serialised internalid: ' + serialised[0].getValue('internalid'));
					record = nlapiLoadRecord('serializedinventoryitem', serialised[0].getValue('internalid'));
				} else {					
					//create new record
					// create the serialised item with data
                    nlapiLogExecution('DEBUG','isSerialised() LOG', 'new serialized item from serialized search');
					record = nlapiCreateRecord('serializedinventoryitem');
				}
			}
            	
            
			if(record) {
				if(map.StockCode[2] == true && map.StockCode[1] != "" ) {record.setFieldValue(map.StockCode[1], maxResults[i].getValue(map.StockCode[0]));}
				if(map.Vendor[2] == true && map.Vendor[1] != "") {record.setFieldValue(map.Vendor[1], maxResults[i].getValue(map.Vendor[0]));}
				if(map.VendorStockCode1[2] == true && map.VendorStockCode1[1] != "") {record.setFieldValue(map.VendorStockCode1[1], maxResults[i].getValue(map.VendorStockCode1[0]));}
				if(map.VendorStockCode2[2] == true && map.VendorStockCode2[1] != "") {record.setFieldValue(map.VendorStockCode2[1], maxResults[i].getValue(map.VendorStockCode2[0]));}
				if(map.VendorStockCode3[2] == true && map.VendorStockCode3[1] != "") {record.setFieldValue(map.VendorStockCode3[1], maxResults[i].getValue(map.VendorStockCode3[0]));}
				if(map.VendorStockCode4[2] == true && map.VendorStockCode4[1] != "") {record.setFieldValue(map.VendorStockCode4[1], maxResults[i].getValue(map.VendorStockCode4[0]));}
				if(map.StockDescription1[2] == true && map.StockDescription1[1] != "") {record.setFieldValue(map.StockDescription1[1], maxResults[i].getValue(map.StockDescription1[0]));}
				if(map.StockDescription2[2] == true && map.StockDescription2[1] != "") {record.setFieldValue(map.StockDescription2[1], maxResults[i].getValue(map.StockDescription2[0]));}
				if(map.PrimaryCategory[2] == true && map.PrimaryCategory[1] != "") {record.setFieldValue(map.PrimaryCategory[1], maxResults[i].getValue(map.PrimaryCategory[0]));}
				if(map.SecondaryCategory[2] == true && map.SecondaryCategory[1] != "") {record.setFieldValue(map.SecondaryCategory[1], maxResults[i].getValue(map.SecondaryCategory[0]));}
				if(map.TertiaryCategory[2] == true && map.TertiaryCategory[1] != "") {record.setFieldValue(map.TertiaryCategory[1], maxResults[i].getValue(map.TertiaryCategory[0]));}
				if(map.DealerEx1[2] == true && map.DealerEx1[1] != "") {record.setFieldValue(map.DealerEx1[1], stripChars(maxResults[i].getValue(map.DealerEx1[0])));}
				if(map.DealerEx2[2] == true && map.DealerEx2[1] != "") {record.setFieldValue(map.DealerEx2[1], stripChars(maxResults[i].getValue(map.DealerEx2[0])));}
                if(map.StockAvailable[2] == true && map.StockAvailable[1] != "") {record.setFieldValue(map.StockAvailable[1], maxResults[i].getValue(map.StockAvailable[0]));}
				if(map.ETA[2] == true && map.ETA[1] != "") {record.setFieldValue(map.ETA[1], maxResults[i].getValue(map.ETA[0]));}
				if(map.Status[2] == true && map.Status[1] != "") {record.setFieldValue(map.Status[1], maxResults[i].getValue(map.Status[0]));}
				if(map.Type[2] == true && map.Type[1] != "") {record.setFieldValue(map.Type[1], maxResults[i].getValue(map.Type[0]));}
				if(map.BundledItem1[2] == true && map.BundledItem1[1] != "") {record.setFieldValue(map.BundledItem1[1], maxResults[i].getValue(map.BundledItem1[0]));}
				if(map.BundledItem2[2] == true && map.BundledItem2[1] != "") {record.setFieldValue(map.BundledItem2[1], maxResults[i].getValue(map.BundledItem2[0]));}
				if(map.BundledItem3[2] == true && map.BundledItem3[1] != "") {record.setFieldValue(map.BundledItem3[1], maxResults[i].getValue(map.BundledItem3[0]));}
				if(map.BundledItem4[2] == true && map.BundledItem4[1] != "") {record.setFieldValue(map.BundledItem4[1], maxResults[i].getValue(map.BundledItem4[0]));}
				if(map.BundledItem5[2] == true && map.BundledItem5[1] != "") {record.setFieldValue(map.BundledItem5[1], maxResults[i].getValue(map.BundledItem5[0]));}

				if(defaultValues.costestimatetype[2] == true && defaultValues.costestimatetype[1] != "") {record.setFieldValue(defaultValues.costestimatetype[0],defaultValues.costestimatetype[1]);}
				if(defaultValues.cogsaccount[2] == true && defaultValues.cogsaccount[1] != "") {record.setFieldValue(defaultValues.cogsaccount[0],defaultValues.cogsaccount[1]);}
				if(defaultValues.assetaccount[2] == true && defaultValues.assetaccount[1] != "") {record.setFieldValue(defaultValues.assetaccount[0],defaultValues.assetaccount[1]);}
				if(defaultValues.incomeaccount[2] == true && defaultValues.incomeaccount[1] != "") {record.setFieldValue(defaultValues.incomeaccount[0],defaultValues.incomeaccount[1]);}
				if(defaultValues.purchasetaxcode[2] == true && defaultValues.purchasetaxcode[1] != "") {record.setFieldValue(defaultValues.purchasetaxcode[0],defaultValues.purchasetaxcode[1]);}
				if(defaultValues.salestaxcode[2] == true && defaultValues.salestaxcode[1] != "") {record.setFieldValue(defaultValues.salestaxcode[0],defaultValues.salestaxcode[1]);}
				if(defaultValues.department[2] == true && defaultValues.department[1] != "") {record.setFieldValue(defaultValues.department[0],defaultValues.department[1]);}
				if(defaultValues.class[2] == true && defaultValues.class[1] != "") {record.setFieldValue(defaultValues.class[0],defaultValues.class[1]);}
				
				
				//check to see if the vendor has been attached already and to select it, if not, create a vendor sublist.
				if(record.getLineItemCount('itemvendor') > 0) {
					var checked = false;
					for(loop=1;loop < record.getLineItemCount('itemvendor')+1;loop++) {
						if(record.getLineItemValue('itemvendor','vendor', loop) == defaultValues.vendor[1]){
							checked = true;
							break;
						}
					}
					if(checked) {
						if(defaultValues.vendor[2] == true && defaultValues.vendor[1] != "") {
							record.selectLineItem('itemvendor', loop);
							record.setCurrentLineItemValue('itemvendor', 'vendor', defaultValues.vendor[1]);
							}
					}
					else {
						record.selectNewLineItem('itemvendor');		
						if(defaultValues.vendor[2] == true && defaultValues.vendor[1] != "") {record.setCurrentLineItemValue('itemvendor', 'vendor', defaultValues.vendor[1]);}
					}
				}
				else{
					record.selectNewLineItem('itemvendor');		
					if(defaultValues.vendor[2] == true && defaultValues.vendor[1] != "") {record.setCurrentLineItemValue('itemvendor', 'vendor', defaultValues.vendor[1]);}
				}
				if(map.StockCode[2] == true && map.StockCode[1] != "") {
                  record.setCurrentLineItemValue('itemvendor', 'vendorcode', maxResults[i].getValue(map.StockCode[0]));
                }
				record.commitLineItem('itemvendor');
                
                if(map.RRPEx[2] == true && map.RRPEx[1] != "") {
                  //nlapiGetLineItemMatrixValue('price1', 'price', 1, 1);
                  record.selectLineItem('price1', 1);
                  record.setCurrentLineItemMatrixValue('price1', 'price', 1, stripChars(maxResults[i].getValue(map.RRPEx[0])));
                  record.commitLineItem('price1');
                }
                
				nlapiSubmitRecord(record);
				recordsupdated++;
			}
				// nlapiDeleteRecord('customrecord_ dd_update', maxResults[i].getValue('internalid') );
				record = nlapiLoadRecord('customrecord_ dd_update', maxResults[i].getValue('internalid'));
				record.setFieldValue('custrecord_updated','T');
				nlapiSubmitRecord(record);
		}
		nlapiLogExecution('DEBUG','isSerialised() LOG', 'Records Updated: ' + recordsupdated);

		maxResults = nlapiSearchRecord('customrecord_ dd_update', null, filters, columns);
		
		if(maxResults) {
			nlapiScheduleScript('customscript_dd_inbound_is_serial_chk', 'customdeploy_dd_inbound_is_serial_chk_dp', null);	
			nlapiLogExecution('DEBUG', 'isSerialised() LOG', 'Records Updated, Scheduled Script for more Updates' );
		} else {
			nlapiLogExecution('DEBUG','isSerialised() LOG', 'Serialised Check and Update Completed.');
			if(PostDeleteCustomRecords) {
				delete_records();
			}
		}

		return true;
	}
	catch(err) {
			var str = '';
			if( err instanceof nlobjError ) {
				var txt = 'ERROR CODE: ' + err.getCode() + '\n ERROR DETAILS: '+ err.getDetails() + '\n ERROR STACK: ' + err.getStackTrace().join(', ');
					str = 'NS ERROR: isSerialised()::\n\n datain: false :: ' + txt;
				nlapiLogExecution('ERROR','isSerialised() error.', txt);
				} 
			else {
				str = 'JS ERROR: isSerialised():: \n\n' + err.toString();
				nlapiLogExecution( 'ERROR', 'isSerialised() error.', str);
			}
			return false;
		}
}

function stripChars(input) {
	input = input.replace(/,/g,'');
	if(input.substring(input.length,1) == ".") {
		input = input.substring(0,input.length-1);
	}
	return input;
}



/*
https://netsuite.custhelp.com/app/answers/detail/a_id/43085/kw/itemvendorprice

Function editItemVendorPrice(){

var itemRecord = nlapiLoadRecord("inventoryitem", 100); // load item
itemRecord.selectLineItem("itemvendor", 1); //select item vendor
var vendor = itemRecord.editCurrentLineItemSubrecord("itemvendor", "itemvendorprice");
vendor.selectLineItem("itemvendorpricelines", 1);
vendor.setCurrentLineItemValue("vendorprice", 1000);
vendor.commitLineItem("itemvendorpricelines");
vendor.commit(); //commit the item vendor price line.
itemRecord.commitLineItem("itemvendor"); // commit item vendor
nlapiSubmitRecord(itemRecord); //submit item record

}
*/

function postProcess(){
	//this function was run as a user event to add prices into the sublist of a vendor subrecord. It requires Netsuite to fixe
	//editCurrentLineItemSubrecord, as the above link shows that it is the only way to set that subrecord but it produces a null error.

	var internalid = nlapiGetRecordId();
	var record = nlapiLoadRecord("serializedinventoryitem", internalid, {recordmode: 'dynamic'});
	var price = nlapiGetFieldValue('cost');
;	for(var loop=1;loop < record.getLineItemCount('itemvendor')+1;loop++) {
		if(record.getLineItemValue('itemvendor','vendor', loop) == defaultValues.vendor[1])
		{
			record.selectLineItem('itemvendor',loop);
			var vendor = record.editCurrentLineItemSubrecord("itemvendor", "itemvendorprice"); // this function produces a null error
			vendor.selectLineItem('itemvendorpricelines', 1);
			if(map.DealerEx[2] == true && map.DealerEx[1] != "") {vendor.setCurrentLineItemValue('vendorcurrency', defaultValues.vendorcurrency[1]);}
			if(map.DealerEx[2] == true && map.DealerEx[1] != "") {vendor.setCurrentLineItemValue('vendorprice',stripChars(price));}
			//if(map.DealerEx[2] == true && map.DealerEx[1] != "") {vendor.setCurrentLineItemValue('itemvendorprice', 'vendorprices', defaultValues.vendorcurrency[1] + ": " + stripChars(maxResults[i].getValue(map.DealerEx[0])));}
			vendor.commitLineItem('itemvendorpricelines');
			vendor.commit();
			record.commitLineItem('itemvendor');
			break;
		}
	}
	nlapiSubmitRecord(record);
}

