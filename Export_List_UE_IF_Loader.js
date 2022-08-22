/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define([
	'N/ui/serverWidget',
	'N/search',
	'N/record',
	'N/util',
    'N/runtime'
], function (serverWidget, search, record, util, runtime) {
    var EDIT_STATUS = 'edit';
    var CREATE_STATUS = 'create';
    var EXPORT_PACKAGES_TAB = 'custom165'; //change this for production
    var homeurl = 'https://xxxxxxx-sb1.app.netsuite.com'; //change this for production

    // get the form data and the package information to format into an export list of pdf forms by url/link.

    function beforeLoad(scriptContext){

        FORM = scriptContext.form;
        newRecord = scriptContext.newRecord;
        FORM.clientScriptFileId = 49913; //check this field on change to production
        IF_ID = scriptContext.newRecord.id;
        SESSION_OBJ = runtime.getCurrentSession();

        TYPE = scriptContext.type;

        var exportPackagesTab = FORM.addSublist({
            id: 'custpage_if_export_sublist',
			type: serverWidget.SublistType.LIST,
			label: 'Export Packages',
            tab: EXPORT_PACKAGES_TAB
        });

        exportPackagesTab.addButton({
            id: 'custpage_if_export_add_btn',
            label: 'Add Export Package',
            functionName: 'addExportPackage'
        });

        var idNo = exportPackagesTab.addField({
            id: 'custpage_if_export_sublist_idno',
            type: serverWidget.FieldType.TEXT,
            label: 'Internal ID'
        });

        idNo.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.NORMAL
            // displayType: serverWidgetAPI.FieldDisplayType.HIDDEN
        });
      
        var exportNo = exportPackagesTab.addField({
			id: 'custpage_if_export_sublist_export_no',
			type: serverWidget.FieldType.TEXT,
			label: 'Export Number'
		});

		exportNo.updateDisplayType({
			//displayType: serverWidget.FieldDisplayType.HIDDEN
			displayType: serverWidget.FieldDisplayType.NORMAL
        });

        var editField = exportPackagesTab.addField({
			id: 'custpage_if_export_sublist_edit_field',
			type: serverWidget.FieldType.TEXT,
			label: 'Edit Export'
		});

		editField.updateDisplayType({
			//displayType: serverWidget.FieldDisplayType.HIDDEN
			displayType: serverWidget.FieldDisplayType.NORMAL
        });
        

        /**********************************************************/
        // create and run a saved search based on custom record item fulfilment id data.

        var ifIdNo = newRecord.getValue({
            fieldId: 'tranid'
        });
        
        var columns = [
            search.createColumn({
                name: "name",
                sort: search.Sort.ASC,
            }),
            search.createColumn({name: "internalid"}),
            search.createColumn({name: "custrecord_export_ifid_orig"})
		];

		var filters = [
            [
                ["custrecord_export_ifid_orig","is", ifIdNo]
             ],
        ];

		var exportIds = search.create({
			type: 'customrecord_export_item_list',
			columns: columns,
			filters: filters
        });

        var internalid = '';
        var name = '';

        var resultSet = exportIds.run();
		var result = getResults(resultSet);

        //log.debug("result: ", result);

        for(i=0;i < result.length; i++){

            internalid = result[i].getValue({ name: 'internalid' });
            name =  result[i].getValue({ name: 'name' });

            //log.debug("iid: ", internalid);
            //log.debug("name: ", name);
            //log.debug("i: ", i);

            exportPackagesTab.setSublistValue({
                id: 'custpage_if_export_sublist_idno',
                value: internalid,
                line: i
            });
            
            exportPackagesTab.setSublistValue({
                id: 'custpage_if_export_sublist_export_no',
                value: name,
                line: i
            });
    
            exportPackagesTab.setSublistValue({
                id: 'custpage_if_export_sublist_edit_field',
                value: '<a href="'+ homeurl +'/app/common/custom/custrecordentry.nl?id=' + internalid + '&rectype=1331&whence=&e=T&pi='+ IF_ID + '&pkgno=' + i + '">Edit</a> | <a href="'+ homeurl +'/app/common/custom/custrecordentry.nl?id=' + internalid + '&rectype=1331&whence=&pi='+ IF_ID + '&pkgno=' + i + '">View</a>',
                line: i
            });

        }


    }

    /*******************************************************************************************************************/
    // get result data into an array from a resultset for data processing
    
	function getResults(resultSet) {
        // gets all the results from a resultset to put into a 
		if (!resultSet) {
			return [];
		}

		var results = [];

		// getRange returns 1000 items at most
		for (var i = 0; ; i++) {
			var tempResults = resultSet.getRange({
				start: i * 1000,
				end: i * 1000 + 1000
			});

			tempResults.forEach(function (result) {
				results.push(result);
			});

			if (tempResults.length < 1000) break;
		}

		return results;
    }
    
    /*******************************************************************************************************************/

    return {
		beforeLoad: beforeLoad,
	};

});