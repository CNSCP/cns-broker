// date.js - Date and time
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Local functions

// Get current date and time
function now() {
  return new Date();
}

// Return formatted date
function toDate(date) {
  // Get date details
  const day = date.getDate();
  const month = date.toLocaleString('en-us', {month: 'long'});
  const year = date.getFullYear();

  return '' + day + ' ' + month + ' ' + year;
}

// Return formatted time
function toTime(date) {
  // Get time details
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();

  const am = (hours <= 12);
  const ampm = am?'am':'pm';

  if (!am) hours -= 12;

  if (minutes < 10) minutes = '0' + minutes;
  if (seconds < 10) seconds = '0' + seconds;

  return '' + hours + ':' + minutes + ampm;
}

// Return formatted date and time
function toDateTime(date) {
  return toDate(date) + ' at ' + toTime(date);
}

// Return elapsed time from date
function toTimeAgo(date) {
  const seconds = Math.floor((now() - date) / 1000);

  var interval;
  var measure;

  if ((interval = Math.floor(seconds / 31536000)) >= 1) measure = 'year';
  else if ((interval = Math.floor(seconds / 2592000)) >=1) measure = 'month';
  else if ((interval = Math.floor(seconds / 86400)) >= 1) measure = 'day';
  else if ((interval = Math.floor(seconds / 3600)) >= 1) measure = 'hour';
  else if ((interval = Math.floor(seconds / 60)) >= 1) measure = 'minute';
  else if ((interval = seconds) >= 1) measure = 'second';
  else return 'Just now';

  if (interval !== 1) measure += 's';

  return '' + interval + ' ' + measure + ' ago';
}

// Exports

exports.now = now;

exports.toDate = toDate;
exports.toTime = toTime;
exports.toDateTime = toDateTime;
exports.toTimeAgo = toTimeAgo;
