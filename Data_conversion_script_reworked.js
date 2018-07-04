/*
* Created By Rick Jones, 2016
*/


// add in the vendor names in the array. eg. "vendorname": ["Lenovo", "IBM"]
var VendorIgnore = {
	"vendorname": []
};


// name : { custom record name, item name, transfer this data? true/false }
var map = {
	"StockCode" : ["itemvendor_vendorcode", true],
	"Vendor" : ["manufacturer", true],	
	"VendorStockCode1" : ["mpn", true],
	"VendorStockCode2" : ["itemid",true],
	"VendorStockCode3" : ["upccode",true],
	"VendorStockCode4" : ["displayname",true],
	"StockDescription1" : ["purchasedescription",true],
	"StockDescription2" : ["salesdescription",true],
	"PrimaryCategory" : [ "custitemprimcat",true],
	"SecondaryCategory" : ["custitemseccat",true],
	"TertiaryCategory" : ["custitemtertcat",true],
	"RRPEx" : ["price1",true],
	"DealerEx1" : ["cost",true],
        "DealerEx2" : ["costestimate",true],
	"StockAvailable" : ["",true],
	"ETA" : ["custitemitemeta",true],
	"Status" : ["",true],
	"Type" : ["",true],
	"BundledItem1" : ["",true],
	"BundledItem2" : ["",true],
	"BundledItem3" : ["",true],
	"BundledItem4" : ["",true],
	"BundledItem5" : ["",true]
};

// these values are defaulted values that are required to update within the new serialised item as well as item lists.
// "name" : ["netsuite field name", "default value", load it or not t/f]

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
var VendorIgnoreBool = false;


/*
* ScriptRunning is a boolean true/false/null to see if this has already been run and is running the remainder of the script for processing
*/

function getJSON(){
	//this function gets the json using netsuites nlapirequesturl with post. It streams it in via json and is parsed.
	//after it is collected and parsed, it is sent to the add to custom records function for processing into netsuite.
	
	if(GetJSON) {
		var url = "https://www.somesite.com/JSONFileName"; //URL Removed for privacy
		var headers = {"Content-Type": "application/json"};
		nlapiLogExecution('DEBUG', 'getJSON() LOG', 'Requesting JSON Data' );
		var response = nlapiRequestURL(url, "", headers, "POST");
                nlapiLogExecution('ERROR', 'getJSON() LOG', 'JSON Data Received. '  + response.getBody());
		var data = JSON.parse(response.getBody());
		nlapiLogExecution('ERROR', 'getJSON() LOG', 'JSON Data Received. '  + ' :: Records: ' + data.length );
	}
	
	if(AddToCustomRecord) {
		nlapiLogExecution('DEBUG', 'getJSON() LOG', 'Data Received For Processing. Creating Scheduled Scripts.' );
		var params = {
			custscript_dd_inbound_datain: JSON.stringify(data)
		};
		//calls the GetJSON script deployment (runGetJSON)
		nlapiScheduleScript('customscript_dd_inbound_data_upd_proc', 'customdeploy_dd_inbound_data_upd_proc_dp', params);					
		nlapiLogExecution('DEBUG', 'getJSON() LOG', 'Initial Scheduled Script Created' );
	}		
	return true;
}

function processJSON(){
    try {
        //this function processes all the json data by getting it sent through from the previous script. As it is a new script, it has new governance and starts
		//again. When run out, it reschedules itself to run.
		var datain;
		var countTotal = 0;
		
		//get the parameters
		if(nlapiGetContext().getSetting('SCRIPT','custscript_dd_inbound_datain')) {
			datain = JSON.parse(nlapiGetContext().getSetting('SCRIPT','custscript_dd_inbound_datain'));
		}
		nlapiLogExecution('DEBUG', 'processJSON() LOG', 'JSON Data Received. Processing into Custom Record. Records: ' + datain.length );

		var usage;
		
		for(count=0;datain.length > 0; count++) {
                        //nlapiLogExecution('DEBUG', 'processJSON() LOG', 'processJSON :: Usage');
			usage = nlapiGetContext().getRemainingUsage();
                        
			if (usage < 300) {
				nlapiLogExecution('DEBUG', 'processJSON() LOG', 'Creating Scheduled Scripts.' );
				var params = {
					custscript_dd_inbound_datain: JSON.stringify(datain)
				};
				nlapiScheduleScript('customscript_dd_inbound_data_upd_proc', 'customdeploy_dd_inbound_data_upd_proc_dp', params);	
				nlapiLogExecution('DEBUG', 'processJSON() LOG', 'New Scheduled Script Created to Continue Processing' );
				break;
			}
                        
                        if(VendorIgnore.vendorname.length != null) {
				for(i=0; i < VendorIgnore.vendorname.length;i++) {
					if(VendorIgnore[i].vendorname == datain[count].Vendor){
						VendorIgnoreBool = true;
                                                break;
					}
				}
			}
                        if(VendorIgnoreBool == false) {
                            nlapiLogExecution('DEBUG', 'processJSON() LOG', 'itemid: ' + datain[count].VendorStockCode.trim() + ' ' );
                            
                            var filters = new Array(); 
                            filters[0] = new nlobjSearchFilter('itemid' , null, 'is', datain[count].VendorStockCode.trim()).setOr(true); 
                            filters[1] = new nlobjSearchFilter('displayname' , null, 'is', datain[count].VendorStockCode.trim() ).setOr(true); 
                            filters[2] = new nlobjSearchFilter('upccode' , null, 'is', datain[count].VendorStockCode.trim() ); 
                            filters[3] = new nlobjSearchFilter('isinactive',null,'is','F');
                             
                            var cols = new Array();
                            cols[0] = new nlobjSearchColumn('internalid');
                            cols[1] = new nlobjSearchColumn('itemid');
                            
                            var itemsearch = nlapiSearchRecord('serializedinventoryitem', null, filters, cols);
                            
                            
                           
                            if(itemsearch) {
                                switch(itemsearch[0].getRecordType()) {
                                    case 'item':
                                        record = nlapiLoadRecord(itemsearch[0].getRecordType(), itemsearch[0].getValue('internalid'));
					record.setFieldValue('itemid', itemsearch[0].getValue('itemid') + "_retired"); //this gets the name and adds retired to it
					record.setFieldValue('isinactive', 'T'); // makes the record inactive
					nlapiSubmitRecord(record);
					
                                        nlapiLogExecution('DEBUG', 'processJSON() LOG', 'itemsearch is not null, item switch');
                                        
					// create the serialised item with data
					record =  nlapiCreateRecord('serializedinventoryitem');
                                        break;
                                    default: //serialized item
                                        nlapiLogExecution('DEBUG', 'processJSON() LOG', 'itemsearch is not null, default switch');
                                        record = nlapiLoadRecord('serializedinventoryitem', itemsearch[0].getValue('internalid'));
                                }
                            } else {
                                nlapiLogExecution('DEBUG', 'processJSON() LOG', 'itemsearch is null');
                                record =  nlapiCreateRecord('serializedinventoryitem');
                            }
                            
                            if(map.Vendor[1] == true && map.Vendor[0] != "") {record.setFieldValue(map.Vendor[0], datain[count].Vendor);}
                            if(map.VendorStockCode1[1] == true && map.VendorStockCode1[0] != "") {record.setFieldValue(map.VendorStockCode1[0], datain[count].VendorStockCode);}
                            if(map.VendorStockCode2[1] == true && map.VendorStockCode2[0] != "") {record.setFieldValue(map.VendorStockCode2[0], datain[count].VendorStockCode);}
                            if(map.VendorStockCode3[1] == true && map.VendorStockCode3[0] != "") {record.setFieldValue(map.VendorStockCode3[0], datain[count].VendorStockCode);}
                            if(map.VendorStockCode4[1] == true && map.VendorStockCode4[0] != "") {record.setFieldValue(map.VendorStockCode4[0], datain[count].VendorStockCode);}
                            if(map.StockDescription1[1] == true && map.StockDescription1[0] != "") {record.setFieldValue(map.StockDescription1[0], datain[count].StockDescription);}
                            if(map.StockDescription2[1] == true && map.StockDescription2[0] != "") {record.setFieldValue(map.StockDescription2[0], datain[count].StockDescription);}
                            if(map.PrimaryCategory[1] == true && map.PrimaryCategory[0] != "") {record.setFieldValue(map.PrimaryCategory[0], datain[count].PrimaryCategory);}
                            if(map.SecondaryCategory[1] == true && map.SecondaryCategory[0] != "") {record.setFieldValue(map.SecondaryCategory[0], datain[count].SecondaryCategory);}
                            if(map.TertiaryCategory[1] == true && map.TertiaryCategory[0] != "") {record.setFieldValue(map.TertiaryCategory[0], datain[count].TertiaryCategory);}
                            if(map.DealerEx1[1] == true && map.DealerEx1[0] != "") {record.setFieldValue(map.DealerEx1[0], stripChars(datain[count].DealerEx));}
                            if(map.DealerEx2[1] == true && map.DealerEx2[0] != "") {record.setFieldValue(map.DealerEx2[0], stripChars(datain[count].DealerEx));}
                            if(map.StockAvailable[1] == true && map.StockAvailable[0] != "") {record.setFieldValue(map.StockAvailable[0], datain[count].StockAvailable);}
                            if(map.ETA[1] == true && map.ETA[0] != "") {record.setFieldValue(map.ETA[0], datain[count].ETA);}
                            if(map.Status[1] == true && map.Status[0] != "") {record.setFieldValue(map.Status[0], datain[count].Status);}
                            if(map.Type[1] == true && map.Type[0] != "") {record.setFieldValue(map.Type[0], datain[count].Type);}
                            if(map.BundledItem1[1] == true && map.BundledItem1[0] != "") {record.setFieldValue(map.BundledItem1[0], datain[count].BundledItem1);}
                            if(map.BundledItem2[1] == true && map.BundledItem2[0] != "") {record.setFieldValue(map.BundledItem2[0], datain[count].BundledItem2);}
                            if(map.BundledItem3[1] == true && map.BundledItem3[0] != "") {record.setFieldValue(map.BundledItem3[0], datain[count].BundledItem3);}
                            if(map.BundledItem4[1] == true && map.BundledItem4[0] != "") {record.setFieldValue(map.BundledItem4[0], datain[count].BundledItem4);}
                            if(map.BundledItem5[1] == true && map.BundledItem5[0] != "") {record.setFieldValue(map.BundledItem5[1], datain[count].BundledItem5);}

                            if(defaultValues.costestimatetype[2] == true) {record.setFieldValue(defaultValues.costestimatetype[0],defaultValues.costestimatetype[1]);}
                            if(defaultValues.cogsaccount[2] == true) {record.setFieldValue(defaultValues.cogsaccount[0],defaultValues.cogsaccount[1]);}
                            if(defaultValues.assetaccount[2] == true) {record.setFieldValue(defaultValues.assetaccount[0],defaultValues.assetaccount[1]);}
                            if(defaultValues.incomeaccount[2] == true) {record.setFieldValue(defaultValues.incomeaccount[0],defaultValues.incomeaccount[1]);}
                            if(defaultValues.purchasetaxcode[2] == true) {record.setFieldValue(defaultValues.purchasetaxcode[0],defaultValues.purchasetaxcode[1]);}
                            if(defaultValues.salestaxcode[2] == true) {record.setFieldValue(defaultValues.salestaxcode[0],defaultValues.salestaxcode[1]);}
                            if(defaultValues.department[2] == true) {record.setFieldValue(defaultValues.department[0],defaultValues.department[1]);}
                            if(defaultValues.class[2] == true) {record.setFieldValue(defaultValues.class[0],defaultValues.class[1]);}
                            
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
                            if(map.StockCode[1] == true) {
                                record.setCurrentLineItemValue('itemvendor', 'vendorcode', datain[count].StockCode);
                            }
                            record.commitLineItem('itemvendor');

                            if(map.RRPEx[1] == true) {
                                //nlapiGetLineItemMatrixValue('price1', 'price', 1, 1);
                                record.selectLineItem('price1', 1);
                                record.setCurrentLineItemMatrixValue('price1', 'price', 1, stripChars(datain[count].RRPEx));
                                record.commitLineItem('price1');
                            }

                            countTotal = countTotal + 1;
                            nlapiSubmitRecord(record);
                            record = null;
			}
			
			datain.shift();
                }


    nlapiLogExecution('ERROR', 'processJSON() LOG', 'Finished Processing Script' );

    }
    catch(err) {
            var str = '';
            if( err instanceof nlobjError ) {
                    var txt = 'ERROR CODE: ' + err.getCode() + '\n ERROR DETAILS: '+ err.getDetails() + '\n ERROR STACK: ' + err.getStackTrace().join(', ');
                    if(datain)
                            {
                            txt = txt + '\n\n datain: ' + JSON.stringify(datain); 
                            str = 'NS ERROR: processJSON():: datain: true :: ' + txt;
                            }
                    else {
                          str = 'NS ERROR: processJSON():: datain: false :: ' + txt;
                         }
                    nlapiLogExecution('ERROR','processJSON() error.', txt);
                    } 
            else {
                    str = 'JS ERROR: ProcessDataInArray():: ' + err.toString() + '  :: Datain : ' + datain.length + ' Count: ' + count;
                    nlapiLogExecution( 'DEBUG', 'processJSON() error.', str);
            }
            return false;
    }

}

    

    
function stripChars(input) {
    if(input) {
	input = input.replace(/,/g,'');
	if(input.substring(input.length,1) == ".") {
		input = input.substring(0,input.length-1);
	}
    }
    return input;
}
