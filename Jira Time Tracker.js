// ==UserScript==
// @name         JADDER - Jira Time Tracker
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://jira.dormakaba.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /*
      Examlple Url:
      Time is in hours
      https://myJira.atlassian.net/secure/Dashboard.jspa#book_PROJ-20::1.5;PROJ-1409::0.25;PROJ-4754::0.5;PROJ-1452::0.5;PROJ-4779::3;
    */
    const bookWorklog = function (ticket, time, comment, dateStarted, $container) {
        var payLoad = {
            "timeSpentSeconds" : 3600 * parseFloat(time),
        };

        if(comment) {
            payLoad.comment = comment;
        }
        if(dateStarted) {
            payLoad.started = dateStarted + "T07:33:32.113+0000";
        }

        jQuery.ajax({
            async: false,
            type: "POST",
            url: "/rest/api/2/issue/"+ticket+"/worklog",
            data: JSON.stringify(payLoad),
            contentType: "application/json",
            dataType: "application/json",
            error: function (xhr, ajaxOptions, thrownError) {
                console.log(payLoad);
                console.log(xhr);
                console.log(thrownError);
            }
        });

        if($container.find(".jira-entry").length == 0) {
            $container.remove();
            window.location.hash="";
        }
    }


    var hashString = window.location.hash;
    if(hashString && hashString.indexOf("#book_") == 0) {

        // PROJ-513::2.5;KON%20Deploy%20Orga::2.25;PROJ-3251::2.5;PROJ-1425::0.5;PROJ-4689::0.25;::;::;::;::;
        var taskList = hashString.substring(6);
        /*
        ["PROJ-513::2.5","KON%20Deploy%20Orga::2.25","PROJ-3251::2.5"]
        */
        var splittedList = taskList.split(";")
        var $container = jQuery("<div id='jira-adder'><h2 style='margin-bottom:10px'>Add To Jira</h2></div>");
        var autoBookEnabled = hashString.indexOf("enableJiraAutoBooking=true") != -1;
        splittedList.forEach(el => {
            var entry = el.split("::");
            var ticket = entry[0];
            var time = entry[1];
            var comment = "";
            var dateStarted = "";
            console.log(entry);
            if(ticket && ticket.match(/\d+$/g)){
                if(entry.length > 2){
                    comment = decodeURIComponent(entry[2]);
                }
                if(entry.length > 3){
                    dateStarted = entry[3];
                }
                console.log(ticket, time);
                var $entry = jQuery("<div class='jira-entry' style='margin-bottom:5px'></div>");
                $entry.append("<input type='text' name='id' placeholder='Ticket' value='"+ticket+"'/>");
                $entry.append("<input type='text' name='comment' placeholder='Comment' value='"+comment+"'/>");
                $entry.append("<input type='text' name='time' placeholder='Time HH,mm' value='"+time+"'/>");
                $entry.append("<input type='text' name='dateStarted' placeholder='Date started yyyy-MM-dd' value='"+dateStarted+"'/>");
                $entry.append("<input type='submit' name='submit' value='Add'/>");

                if(autoBookEnabled){
                    bookWorklog(ticket, time, comment,dateStarted,$container);
                } else {
                    $container.append($entry);
                }
            }
        });

        $container.css({
            "position":"absolute",
            "padding":"5px",
            "top":"50%",
            "left":"50%",
            "width":"500px",
            "heigt" : "auto",
            "z-index": 10000,
            "background": "white",
            "transform": "translate(-50%, -50%)",
            "box-shadow" : "5px 5px 10px black"
        })

        $container.on("click", "[type='submit']", (event) => {

            var $entry = jQuery(event.currentTarget).parent();

            var ticket = $entry.find("[name='id']").val();
            var comment = $entry.find("[name='comment']").val();
            var time = $entry.find("[name='time']").val();
            var dateStarted = $entry.find("[name='dateStarted']").val();

            bookWorklog(ticket, time, comment,dateStarted,$container);
        });

        if(!autoBookEnabled){
            jQuery("body").append($container);
        } else {
            window.close();
        }
    }
})();