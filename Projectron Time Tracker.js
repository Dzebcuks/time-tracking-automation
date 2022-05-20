// ==UserScript==
// @name         Projektron Booking Tool
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://projektron.valantic.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=valantic.com
// @grant        none
// ==/UserScript==


(function () {
    'use strict';

    const successMessage = "Aufwände gebucht";
    const MESSAGES = ".msg.affirmation";
    const ERROR_MESSAGES = ".msg.error";
    const DAY_PICKER = ".calendarcontrol_datedisplay";
    const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
    const noTimeOnTicketTask = "no time on ticket";

    const bookTime = async function () {
        console.log(document.referrer)
        if (document.referrer == '') {
            Object.defineProperty(document, "referrer", {
                get: function () {
                    //return "https://mitarbeiter.neusta.de/timesheet?book_PIM%20::refinement::Produktdaten,%20Konzept%20Produktmodellierung%20SAP%20CC::3.50::2022-05-10"
                }
            });
        }
        if (hasSuccessMessage()) {
            window.close();
        }

        /*
          Examlple Url:
          Time is in hours
          https://mitarbeiter.neusta.de/timesheet?book_Base%20Setup%20::refinement::Setting%20up::1.00::2022-05-11;
        */

        if (!hasErrorMessage()) {
            let hashString = document.referrer;
            if (hashString && hashString.indexOf("?book_") != -1) {
                hashString = hashString.substring(hashString.indexOf("?book_") + 6);
                /*
                ["PROJ-513::2.5","KON%20Deploy%20Orga::2.25","PROJ-3251::2.5"]
                */
                const autoBookEnabled = hashString.indexOf("enableJiraAutoBooking=true") != -1;
                const entry = hashString.split("::");
                const ticket = decodeURI(entry[0]).trim();
                const ticketType = entry[1].trim();
                const time = entry[3].replace(".", ",");
                let comment = "";
                let dateStarted = "";
                console.log(entry);
                if (ticket) {
                    if (entry.length > 3) {
                        comment = decodeURI(entry[2]);
                    }
                    if (entry.length > 4) {
                        dateStarted = entry[4];
                    }
                    console.log(ticket, time);
                    chooseCorrectDay(ticket.toLowerCase(), ticketType.toLowerCase(), time, comment, dateStarted);
                }

                if (autoBookEnabled) {
                    //  window.close();
                }
            } else {
                const localStorageTicket = window.localStorage.getItem('ticket');
                const localStorageTicketType = window.localStorage.getItem('ticketType');
                const localStorageTime = window.localStorage.getItem('time');
                const localStorageComment = window.localStorage.getItem('comment');
                const localStorageDateStarted = window.localStorage.getItem('dateStarted');

                if (localStorageTicket != null && localStorageTicketType != null && localStorageTime != null && localStorageComment != null && localStorageDateStarted != null) {
                    // delete all items from local storage
                    window.localStorage.removeItem('ticket');
                    window.localStorage.removeItem('ticketType');
                    window.localStorage.removeItem('time');
                    window.localStorage.removeItem('comment');
                    window.localStorage.removeItem('dateStarted');

                    chooseCorrectDay(localStorageTicket.toLowerCase(), localStorageTicketType.toLowerCase(), localStorageTime, localStorageComment, localStorageDateStarted);
                }
            }
        }
    }
    const wait = function (time) {
        const promise = new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('done');
            }, time);
        });
        return promise;
    }

    const saveDateInLocalStorage = async function (ticket, ticketType, time, comment, dateStarted) {
        window.localStorage.setItem('ticket', ticket);
        window.localStorage.setItem('ticketType', ticketType);
        window.localStorage.setItem('time', time);
        window.localStorage.setItem('comment', comment);
        window.localStorage.setItem('dateStarted', dateStarted);
    }

    const chooseCorrectDay = async function (ticket, ticketType, time, comment, dateStarted) {
        const datePicker = document.querySelector(DAY_PICKER);
        const currentDate = datePicker.innerText;
        const dateMatch = DATE_REGEX.exec(dateStarted);

        console.log(dateMatch)
        if (dateMatch) {
            const year = dateMatch[1];
            const month = dateMatch[2];
            let day = dateMatch[3];
            if (day.startsWith("0")) {
                day = day.substring(1);
            }

            const dateStartedInCorrectFormat = day + "." + month + "." + year.substring(2);
            if (!currentDate.includes(dateStartedInCorrectFormat)) {
                console.log("choosing different date");
                // open date dialog first
                datePicker.click();
                await wait(200);

                // search correct day
                console.log(day);
                const days = document.querySelectorAll(".day > a");
                days.forEach(function (dayElement, index) {
                    if (dayElement.innerText == day) {
                        saveDateInLocalStorage(ticket, ticketType, time, comment, dateStarted);
                        dayElement.click();
                        console.log("found date to switch" + dayElement.innerText)
                    }
                });
            } else {
                bookWorklog(ticket.toLowerCase(), ticketType.toLowerCase(), time, comment, dateStarted);
            }
        }
    }

    const hasSuccessMessage = function () {
        let messageFound = false;
        const messages = document.querySelectorAll(MESSAGES);
        if (messages.length > 0) {
            const message = messages[0].innerHTML;
            if (message.includes(successMessage)) {
                messageFound = true;
            } else {
                alert("got an message, but it was no success, please check");
            }
        }
        return messageFound;
    }
    const hasErrorMessage = function () {
        let messageFound = false;
        const messages = document.querySelectorAll(ERROR_MESSAGES);
        if (messages.length > 0) {
            messageFound = true;
        }
        return messageFound;
    }
    const addNewTimeBookingRowOrFillTimeAndComment = async function (possibleResults, index, comment, time) {
        let taskFound = false;
        const commentTextArea = possibleResults[index].querySelectorAll("textArea")[0];
        if (commentTextArea.value === "") {
            // check if left time on task is possible within current booking
            let leftTimeOnTask = Number.MAX_SAFE_INTEGER;
            const allowedTotalHoursOnTask = Number(possibleResults[index].querySelector("[name=indicatorSumDedicatedExpense]").innerHTML.replace("h", ""));
            let alreadyBookedHoursOnTask = 0;
            const alreadyBookedHoursOnTaskElement = possibleResults[index].querySelector("[name=indicatorSumRealExpense] > span");
            if (alreadyBookedHoursOnTaskElement != null) {
                const alreadyBookedHoursOnTaskValue = possibleResults[index].querySelector("[name=indicatorSumRealExpense] > span").innerHTML;
                if (alreadyBookedHoursOnTaskValue != null) {
                    alreadyBookedHoursOnTask = Number(alreadyBookedHoursOnTaskValue.replace("h", "").replace(",", "."));
                }
                leftTimeOnTask = allowedTotalHoursOnTask - alreadyBookedHoursOnTask;
            }

            // check if time has number format
            if (!Number.isInteger(time)) {
                time = Number(String(time).replace(",", "."));
            }

            if (time > leftTimeOnTask) {
                // paste only the maximum allowed
                if (leftTimeOnTask > 0) {
                    possibleResults[index].querySelectorAll(".textfield.number")[2].value = String(leftTimeOnTask).replace(".", ",");
                    possibleResults[index].querySelectorAll("textArea")[0].value = comment;
                }
                await setCommentAndTime(noTimeOnTicketTask, "", comment, time - leftTimeOnTask);
            } else {
                // paste the wasted time
                possibleResults[index].querySelectorAll(".textfield.number")[2].value = String(time).replace(".", ",");
                ;
                possibleResults[index].querySelectorAll("textArea")[0].value = comment;
            }
            taskFound = true;
        }
        return taskFound;
    }

    const addNewRowIfRequired = async function (possibleResults) {
        const addNewRowButton = possibleResults[0].querySelector("button[title='Zeile hinzufügen.']");
        if (addNewRowButton) {
            addNewRowButton.click();
        }
    }

    const findPossibleTasks = async function (ticket, ticketType) {
        const taskOptions = document.querySelectorAll(".row.default.selectableRow");
        const possibleResults = [];
        taskOptions.forEach(function (task, index) {
            // try to find the correct task
            const projectInformationFields = task.querySelectorAll(".hover.toBlur");
            if (projectInformationFields.length > 2) {
                const taskName = task.querySelectorAll(".hover.toBlur")[2].innerHTML.toLowerCase();
                if (taskName.includes(ticket) && taskName.includes(ticketType)) {
                    possibleResults.push(task);
                }
            }
        });
        return possibleResults;
    }

    const setCommentAndTime = async function (ticket, ticketType, comment, time) {
        let taskFound = false;
        console.log("search ticket where " + ticket + " and " + ticketType + " is included")
        let possibleResults = await findPossibleTasks(ticket, ticketType);

        if (possibleResults.length === 1) {
            const commentTextArea = possibleResults[0].querySelectorAll("textArea")[0];
            if (commentTextArea.value !== "") {
                // add a new row
                await addNewRowIfRequired(possibleResults);
                possibleResults = await findPossibleTasks(ticket, ticketType);
                taskFound = await addNewTimeBookingRowOrFillTimeAndComment(possibleResults, 1, comment, time);
            } else {
                taskFound = await addNewTimeBookingRowOrFillTimeAndComment(possibleResults, 0, comment, time);

            }
        } else if (possibleResults.length > 1) {
            await addNewRowIfRequired(possibleResults);
            possibleResults = await findPossibleTasks(ticket, ticketType);
            taskFound = await addNewTimeBookingRowOrFillTimeAndComment(possibleResults, 1, comment, time);
        }
        return taskFound;
    }
    const bookWorklog = async function (ticket, ticketType, time, comment, dateStarted) {
        console.log(ticket, ticketType, time, comment, dateStarted)
        ticket = decodeURI(ticket);

        let taskFound = await setCommentAndTime(ticket, ticketType, comment, time);

        if (taskFound) {
            // if task could be found, then submit the result
            document.querySelector("[data-bcs-submit-button=true]").click();
        } else {
            taskFound = await setCommentAndTime(ticket, ticketType, comment, time);
            if (!taskFound) {
                alert("no task was found");
            } else {
                document.querySelector("[data-bcs-submit-button=true]").click();
            }
        }
    }
    bookTime();

})();