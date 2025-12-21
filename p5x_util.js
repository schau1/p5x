/*
 * File: p5x_utils.js
 *
 * Description: Common utility functions. Could be quickly modified for another future project  
 * 
 * Author: schau1 / cantiga
 * 
 * Copyright (c) 2025
 * DO NOT TAKE OR MODIFY MY CODE FOR YOUR USE WITHOUT ASKING 
 * 
*/

function filterFunction(inputId, divId, tagId) {
    var input, filter, ul, li, a, i;
    input = document.getElementById(inputId);
    filter = input.value.toUpperCase();
    div = document.getElementById(divId);
    a = div.getElementsByTagName(tagId);
    for (i = 0; i < a.length; i++) {
        txtValue = a[i].textContent || a[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            a[i].style.display = "";
        } else {
            a[i].style.display = "none";
        }
    }
}

function findElement(arr, propName, propValue) {
    for (var i = 0; i < arr.length; i++)
        if (arr[i][propName] == propValue)
            return arr[i];
}

// Get a specific value pair from the item
// Example let var = [ 'animal': 'dog', 'breed': 'mix'], passing 'animal' as item, will return 'dog'
function getValueFromDatabaseItem(item, name) {
    var i = findElement(item, "name", name);

    return i["value"];
}

function setValueToDatabaseItem(item, name, value) {
    var i = findElement(item, "name", name);

    i["value"] = value;
}

// Load file from local server
function loadFile(filePath) {
    var result = null;
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.send();
    if (xmlhttp.status == 200) {
        result = xmlhttp.responseText;
    }

    return result;
}

// ref: http://stackoverflow.com/a/1293163/2343
// This will parse a delimited string into an array of
// arrays. The default delimiter is the comma, but this
// can be overriden in the second argument.
function CSVToArray(strData, strDelimiter) {
    // Check to see if the delimiter is defined. If not,
    // then default to comma.
    strDelimiter = (strDelimiter || ",");
    //    console.log(strData);
    // Create a regular expression to parse the CSV values.
    var objPattern = new RegExp(
        (
            // Delimiters.
            "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

            // Quoted fields.
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

            // Standard fields.
            "([^\"\\" + strDelimiter + "\\r\\n]*))"
        ),
        "gi"
    );


    // Create an array to hold our data. Give the array
    // a default empty first row.
    var arrData = [[]];

    // Create an array to hold our individual pattern
    // matching groups.
    var arrMatches = null;


    // Keep looping over the regular expression matches
    // until we can no longer find a match.
    while (arrMatches = objPattern.exec(strData)) {

        // Get the delimiter that was found.
        var strMatchedDelimiter = arrMatches[1];

        // Check to see if the given delimiter has a length
        // (is not the start of string) and if it matches
        // field delimiter. If id does not, then we know
        // that this delimiter is a row delimiter.
        if (
            strMatchedDelimiter.length &&
            strMatchedDelimiter !== strDelimiter
        ) {

            // Since we have reached a new row of data,
            // add an empty row to our data array.
            arrData.push([]);

        }

        var strMatchedValue;

        // Now that we have our delimiter out of the way,
        // let's check to see which kind of value we
        // captured (quoted or unquoted).
        if (arrMatches[2]) {

            // We found a quoted value. When we capture
            // this value, unescape any double quotes.
            strMatchedValue = arrMatches[2].replace(
                new RegExp("\"\"", "g"),
                "\""
            );

        } else {

            // We found a non-quoted value.
            strMatchedValue = arrMatches[3];

        }


        // Now that we have our value string, let's add
        // it to the data array.
        arrData[arrData.length - 1].push(strMatchedValue);
    }

    // Return the parsed data.
    return (arrData);
}

// ----------------- General HTML Support - Work only for this tree mode -------------------------------//
function replaceHeaderWithOptionName(event) {
    const targetElement = event.target;

    var divSibling = targetElement.parentNode.parentNode.firstElementChild;

    divSibling.innerHTML = targetElement.innerHTML;

    var x = targetElement.parentNode;

    if (x.className.indexOf("w3-hide") == -1) {
        x.className += " w3-hide";
    }
}

function replaceHeaderWithName(cell) {
    var divParent = cell.parentNode.parentNode;

    charName = cell.innerHTML;
    divParent.children[0].innerHTML = cell.innerHTML;

    var x = cell.parentNode;

    if (x.className.indexOf("w3-hide") == -1) {
        x.className += " w3-hide";
    }
}

function show(event) {
    const targetElement = event.target;
    var x = targetElement.parentNode.firstElementChild.nextElementSibling;

    x.className = x.className.replace(" w3-hide", "");
}

function outputNameCommon(dropdown, list) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].name != "") {
            var item = document.createElement("a");
            item.setAttribute('class', 'w3-bar-item w3-button');
            item.innerHTML = list[i].name;
            item.onclick = function () {
                replaceHeaderWithName(this);
            };

            dropdown.appendChild(item);
        }
    }
}

function fillHtmlCommon(htmlDivId, filterHmtlId, list, addSearchField = true) {
    let dropdown = document.getElementById(htmlDivId);
    var firstChild = dropdown.children[0];  // Save the search Filter
    
    dropdown.textContent = '';

    if (addSearchField) {
        dropdown.appendChild(firstChild);   //add back the search field
        document.getElementById(filterHmtlId).value = '';
    }

    outputNameCommon(dropdown, list);

    const targetElement = dropdown;
    var x = targetElement.parentNode.firstElementChild.nextElementSibling;

    x.className = x.className.replace(" w3-hide", "");
}

function fillListWithOutputPanel(event, debuffArray) {
    const targetElement = event.target;
    var divSibling = targetElement.parentNode.children[1];

    let dropdown = document.getElementById(divSibling.id);
    var firstChild = dropdown.children[0]; // Save the search Filter

    // If the list is already fill, just return
    if (firstChild.nextElementSibling) {
        return;
    }

    dropdown.textContent = '';
    dropdown.appendChild(firstChild); //add back the search field

/*    var item = document.createElement("a");
    item.setAttribute('class', 'w3-bar-item w3-button');
    item.innerHTML = "Reset";
    item.onclick = function () {
        resetList(targetElement.parentNode.parentNode.children[1].firstElementChild.id);
    };
    dropdown.appendChild(item);*/
   
    var outputDiv = "", listDiv = "";

    switch (divSibling.id) {
        case "wDBuffListDiv":
            outputDiv = "wDBuffOutputDiv";
            listDiv = "wDBuffListDiv";
            document.getElementById("userFilterwDBuffList").value = '';
            break;
        case "dpsDBuffListDiv":
            outputDiv = "dpsDBOutputDiv";
            listDiv = "dpsDBuffListDiv";
            document.getElementById("userFilterDpsDbufflist").value = '';
            break;
        case "p1DBuffListDiv":
            outputDiv = "p1DBuffOutputDiv";
            listDiv = "p1DBuffListDiv";
            document.getElementById("userFilterP1DBuffList").value = '';
            break;
        case "p2DBuffListDiv":
            outputDiv = "p2DBuffOutputDiv";
            listDiv = "p2DBuffListDiv";
            document.getElementById("userFilterP2DBuffList").value = '';
            break;
        case "naviDBuffListDiv":
            outputDiv = "naviDBuffOutputDiv";
            listDiv = "naviDBuffListDiv";
            document.getElementById("userFilternaviDBuffList").value = '';
            break;
        default:
            console.log("Error. Defaulting to wDBuffListDiv");
            outputDiv = "wDBuffOutputDiv";
            listDiv = "wDBuffListDiv";
            document.getElementById("userFilterwDBuffList").value = '';
            break;
    }

    outputList(dropdown, debuffArray, outputDiv, listDiv);

    var x = dropdown.parentNode.firstElementChild.nextElementSibling;
    x.className = x.className.replace(" w3-hide", "");
}

function resetList(listName, saveFirstChild) {
    var divParent = document.getElementById(listName);
    var firstChild = divParent.children[0]; // Save the search Filter   

    while (divParent.firstChild) {
        divParent.removeChild(divParent.lastChild);
    }

    if (saveFirstChild) {
        divParent.appendChild(firstChild); //add back the search field
    }
}

function outputList(dropdown, itemArray, outputDiv, listDiv) {
    for (var i = 0; i < itemArray.length; i++) {
        var item = document.createElement("a");
        item.setAttribute('class', 'w3-bar-item w3-button');
        item.innerHTML = itemArray[i];
        item.onclick = function () {
            addItemToList(this, outputDiv, listDiv);
        };

        dropdown.appendChild(item);
    }
}

function addItemToListNoButton(name, outputDiv) {
    var output = document.getElementById(outputDiv);
    var item = document.createElement("li");
    var el = output.firstChild;
    var add = true;

    while (el) {
        if (el.innerHTML == name) {
            add = false;
            break;
        }
        el = el.nextSibling;
    }
    if (add) {
        item.setAttribute('class', 'w3-block w3-left-align w3-light-gray');
        item.innerHTML = name;

        output.appendChild(item);
    }
}

function addItemToList(cell, outputDiv, listDiv) {
    var output = document.getElementById(outputDiv);
    var el = output.firstChild;
    var add = true;

    while (el) {
        if (el.innerHTML == cell.innerHTML) {
            add = false;
            break;
        }
        el = el.nextSibling;
    }

/*  var el = document.getElementById(listDiv).firstChild;

    while (el) {
        if (el.innerHTML == cell.innerHTML) {
            document.getElementById(listDiv).removeChild(el);
            break;
        }
        el = el.nextSibling;
    }
*/
    if (add) {
        var item = document.createElement("li");
        item.setAttribute('class', 'w3-block w3-left-align');
        item.innerHTML = cell.innerHTML;
        item.onclick = function () {
            removeItemFromList(this, outputDiv);
        };

        output.appendChild(item);
    }
}

function removeItemFromList(cell, name) {
    var divParent = document.getElementById(name);

    var el = divParent.firstChild;

    while (el) {
        if (el.innerHTML == cell.innerHTML) {
            divParent.removeChild(el);
            break;
        }
        el = el.nextSibling;
    }
 }
// ----------------- End of General HTML Support -------------------------------//

