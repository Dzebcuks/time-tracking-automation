// ==UserScript==
// @name         Neusta2Projektron
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://mitarbeiter.neusta.de/*
// @grant        none
// @require      http://code.jquery.com/jquery-3.4.1.min.js
// ==/UserScript==
(function () {
    'use strict';
    const internalRegex = /^(\d\d):(\d\d)\s+(\d\d):(\d\d)\s+(\d?\d?.?\d?\d)?\s?(.+)$/;
    const regex = /^(\d\d):(\d\d)\s+(\d\d):(\d\d)\s+(\d?\d?.?\d?\d)?\s?(.*)(refine|impl|meeting|time)\s?(.+)$/;
    const REFINEMENT = "refinement";
    const IMPLEMENTATION = "implementation";
    const MEETING = "meeting";
    const dateRegex = /^(\d*)\.(\d*)\.(\d*)$/;
    const keyCodes = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57];
    var DATE_PICKER = ".mat-datepicker-input";
    var ADD_BUTTON = ".toolbar__action button";
    var TIME_HOUR = ".ngx-timepicker__control--first input";
    var TIME_MINUTE = ".ngx-timepicker__control--third input";
    var HOURS = "[data-placeholder=Stunden]";
    var PAUSE = "[data-placeholder=Pause]";
    var COMMENT = "textarea";
    var COMMENT_INPUT = COMMENT + "+input";
    var DATE = "[formcontrolname='spentOn']";
    var enableJiraBooking = true;
    var enableJiraAutoBooking = false;
    var currentProjectPrefixes = ["HUB", "Valantic"];
    var currentProject = /Huber.*/i;
    var sapCommerceGeneral = /SAP Commerce Bereich intern/i
    // jira url should be start page in order to show overlay. #book_ is the required suffix for other plugin to work
    var projektronUrl = "https://projektron.valantic.com/bcs/mybcs/dayeffortrecording/display?#book_";
    const addFromTextArea = async function (entry) {
        const match = regex.exec(entry);
        const internalBookingMatch = internalRegex.exec(entry);
        if (match) {
            await addFromTextAreaInternal(match, false);
        } else if (internalBookingMatch) {
            await addFromTextAreaInternal(internalBookingMatch, true);
        }
    }
    const addFromTextAreaInternal = async function (match, internalBooking) {
        // Add Ending Hour
        //  document.querySelector(HOURS).value = match[1];
        //   document.querySelector(HOURS).dispatchEvent(new Event("input"));
        //   document.querySelector(HOURS).dispatchEvent(new Event("change"));
        press(document.querySelectorAll(TIME_HOUR)[1], match[3].split("")[0]);
        press(document.querySelectorAll(TIME_HOUR)[1], match[3].split("")[1]);
        // Add Ending Minute
        press(document.querySelectorAll(TIME_MINUTE)[1], match[4].split("")[0]);
        press(document.querySelectorAll(TIME_MINUTE)[1], match[4].split("")[1]);
        // Add Starting Hour
        press(document.querySelectorAll(TIME_HOUR)[0], match[1].split("")[0]);
        press(document.querySelectorAll(TIME_HOUR)[0], match[1].split("")[1]);
        // Add Starting Minute
        press(document.querySelectorAll(TIME_MINUTE)[0], match[2].split("")[0]);
        press(document.querySelectorAll(TIME_MINUTE)[0], match[2].split("")[1]);
        // Add Pause
        match[5] ? document.querySelector(PAUSE).value = match[5] : console.info("no pause");
        document.querySelector(PAUSE).dispatchEvent(new Event("input"));
        document.querySelector(PAUSE).dispatchEvent(new Event("change"));

        // Add Comment
        var comment = internalBooking ? match[6] : match[8];
        var projectronTicket = internalBooking ? "" : match[6];
        var ticketType = internalBooking ? "" : match[7].toLowerCase();
        document.querySelector(COMMENT).value = comment;
        document.querySelector(COMMENT).dispatchEvent(new Event("input"))
        await wait(200);
        // Open Projekt Selection
        document.querySelectorAll("[cdk-overlay-origin]")[1].dispatchEvent(new Event("click"))
        await wait(300);
        // Try to find correct project, otherwise fallback to first one
        var projectOption = 0;
        var allProjectOptions = document.querySelectorAll(".mat-option-text")
        console.info(comment)
        console.info(currentProjectPrefixes)
        allProjectOptions.forEach(function (project, index) {
            if (currentProjectPrefixes.some(prefix => comment.includes(prefix))) {
                console.info(project.innerText)
                if (currentProject.test(project.innerText)) {
                    console.info("its a match " + project.innerText)
                    projectOption = index;
                }
            } else {
                if (ticketType != "" && currentProject.test(project.innerText)) {
                    projectOption = index;
                } else if (projectOption == 0 && sapCommerceGeneral.test(project.innerText)) {
                    projectOption = index;
                }
            }
        });
        // Click on found or first Project Option
        document.querySelectorAll("mat-option")[projectOption].dispatchEvent(new Event("click"))
        await wait(100);
        // Click on second time option
        var options = document.querySelectorAll("[cdk-overlay-origin]")
        if (options.length > 2) {
            document.querySelectorAll("[cdk-overlay-origin]")[2].dispatchEvent(new Event("click"))
            await wait(100);
            document.querySelectorAll("mat-option")[0].dispatchEvent(new Event("click"))
        }
        // Open Activity Selection
        //document.querySelectorAll("[cdk-overlay-origin]")[3].dispatchEvent(new Event("click"))
        //await wait(300);
        // Click on mapped index for Activtiy or else leave Selection Open for manual selection
        if (getIndexForActivity(match[6]) >= 0) {
            document.querySelectorAll("mat-option")[getIndexForActivity(match[6])].dispatchEvent(new Event("click"))
        }
        if (enableJiraBooking) {
            if (ticketType != "") {
                // get date of booking and parse it to required format
                var date = document.querySelector(DATE).value;
                var dateString = "";
                const dateMatch = dateRegex.exec(date);
                if (dateMatch) {
                    const days = dateMatch[1];
                    const month = dateMatch[2];
                    const year = dateMatch[3];
                    if (days && month && year) {
                        dateString = year + "-" + month + "-" + days;
                    }
                }
                // get calculated time from mitarbeiter tool, as it has same format as jira
                var bookedTime = document.querySelectorAll(".cdk-text-field-autofill-monitored")[2].value;
                // get ticket and comment if available
                var shortBookingNote = projectronTicket;
                if (ticketType != "") {
                    if (ticketType == "refine") {
                        shortBookingNote = shortBookingNote + "::" + REFINEMENT;
                    } else if (ticketType == "impl") {
                        shortBookingNote = shortBookingNote + "::" + IMPLEMENTATION;
                    } else if (ticketType == "meeting") {
                        shortBookingNote = shortBookingNote + "::" + MEETING;
                    } else {
                        shortBookingNote = shortBookingNote + "::" + ticketType;
                    }
                }
                shortBookingNote = shortBookingNote + "::" + comment + "::" + bookedTime;

                if (dateString) {
                    shortBookingNote = shortBookingNote + "::" + dateString;
                }
                if (enableJiraAutoBooking) {
                    shortBookingNote = shortBookingNote + ";?enableJiraAutoBooking=true";
                }
                console.log(shortBookingNote);
                window.history.pushState({}, null, "/timesheet?book_" + shortBookingNote);
                var newWindow = window.open(projektronUrl);
            }
        }
    }
    const getIndexForActivity = function (activity) {
        /**
         * 0 = Bug
         * 1 = Code REview
         * 2 = Meetings
         * 3 = Projektleitung
         * 4 = Sonstiges
         * 5 = Story
         */
        if (activity.indexOf("Technisches Standup") >= 0) {
            return 2;
        }
        if (activity.indexOf("Code Reviews") >= 0) {
            return 1;
        }
        if (activity.indexOf("CUSI") >= 0) {
            return 5;
        }
    }
    const isVisible = function (elSelector) {
        const promise = new Promise((resolve, reject) => {
            setInterval(() => {
                if (document.querySelector(elSelector) != null) {
                    resolve('done');
                }
            }, 300);
        });
        return promise;
    }
    const wait = function (time) {
        const promise = new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('done');
            }, time);
        });
        return promise;
    }
    const press = async function (el, key) {
        el.dispatchEvent(new KeyboardEvent('keypress', {
            'keyCode': keyCodes[key]
        }));
        await wait(10);
    }
    const addInputFieldIfMissing = function () {
        window.setInterval(() => {
            if (document.querySelector(COMMENT) && !document.querySelector("#paste")) {
                var input = document.createElement("input");
                input.id = "paste"
                input.style = "width:100%;display:block; margin-top:10px;"
                input.placeholder = "Paste Entry Here"
                document.querySelector(COMMENT).parentElement.parentElement.parentElement.append(input)
                input.addEventListener('blur', (event) => {
                    addFromTextArea(event.target.value)
                });
            }
        }, 100)
    }

    addInputFieldIfMissing();
})();