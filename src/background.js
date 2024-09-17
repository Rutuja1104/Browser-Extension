import { SYSTEM_URL_REGEXP } from './framework/constants';
import {
  initWebSocket,
  auditLogEventHandler,
  checkWsConnection,
  closeWsConnection,
  eventServices,
} from 'container-common/src/helpers/websocket';
import {
  databaseHandler,
  initSentry,
  initCommonInstance,
  setEnvironmentVariables,
} from 'container-common/src/helpers/common-helper';
import {
  dataName,
  operationTypes,
  wsEvents,
} from 'container-common/src/helpers/constant';
import { checkEnablement } from 'container-common/src/helpers/enablementkey-helper';
import * as Sentry from '@sentry/react';
import { myEmitter } from './EventEmitter';
import { customLogger } from 'container-common/src/helpers/container-logger';
import _ from 'underscore';
initCommonInstance('browser', chrome);
eventServices(myEmitter);
let provider_logout = false;
let isenabled = false;
let localstorageCleared = false;
let prevCtx = {};
let isSocketConnection = false;

const checkLocalStorage = async () => {
  chrome.storage.local.get(null, function (items) {
    if (Object.keys(items).length === 0) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          const tabId = tabs[0].id;
          if (!localstorageCleared) {
            localstorageCleared = true;
            chrome.tabs.sendMessage(tabId, { action: 'localStorageEmpty' });
            console.log('EVENT : [LocalStorage EMPTY]');
          }
          let isConnected = checkWsConnection();
          if (isConnected && !provider_logout) {
            closeWsConnection();
            provider_logout = true;
          }
        }
      });
    }
  });
  let tokenData = await databaseHandler(
    operationTypes.GET,
    dataName.TOKEN_DETAILS
  );
  tokenData = tokenData && JSON.parse(tokenData);
  const enablementkeyDetails = await databaseHandler(
    operationTypes.GET,
    dataName.ENABLEMENT_KEY
  );
  const enablementData =
    enablementkeyDetails && JSON.parse(enablementkeyDetails);
  if (!tokenData || !enablementData) {
    chrome.storage.local.clear();
  }
};

const getCurrentTabUrl = () => {
  chrome.tabs.query({}, async function (tabs) {
    const tabUrls = tabs.map((tab) => tab.url);
    const isAnyTabMatching = tabUrls.some((url) => {
      return Object.values(SYSTEM_URL_REGEXP).some((regex) => regex.test(url));
    });
    if (!isAnyTabMatching) {
      provider_logout = true;
      handleProviderLogout();
    }
  });
};

setInterval(async () => {
  if (isenabled) checkLocalStorage();
  if (isSocketConnection) handleCheckSocketConnection();
  getCurrentTabUrl();
}, 3000);

const handleEmitterEvent = (message, data) => {
  chrome.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      sendMessageWithRetry(tab.id, { action: message, data: data });
    });
  });
};

function sendMessageWithRetry(
  tabId,
  message,
  retryCount = 3,
  retryDelay = 5000
) {
  chrome.tabs.sendMessage(tabId, message, function (response) {
    if (chrome.runtime.lastError) {
      if (retryCount > 0) {
        setTimeout(function () {
          sendMessageWithRetry(tabId, message, retryCount - 1, retryDelay);
        }, retryDelay);
      }
    }
  });
}

myEmitter.on('show-notification', (data) => {
  handleEmitterEvent('show-notification', data);
});

myEmitter.on('container-launch', (data) => {
  handleEmitterEvent('container-launch', data);
});

myEmitter.on('config-updated', (data) => {
  handleEmitterEvent('updated-config', data);
});

const handleGetSessionCookies = (sendResponse, request) => {
  chrome.cookies.getAll({ url: request?.url }, function (cookies) {
    let cookieValues = {};
    cookies.forEach(function (cookie) {
      cookieValues[cookie.name] = cookie.value;
    });
    if (request?.ehr === 'ATHENA_EHR') {
      if (Object.keys(cookieValues)?.length > 0) {
        sendResponse({
          sessionId: cookieValues['.SESSIONID'],
          timeOut: cookieValues['.TIMEOUT_UNENCRYPTED'],
        });
      }
    } else if (request?.ehr === 'ECLINICAL') {
      chrome.cookies.getAll(
        { url: 'https://sandbox.eclinicalweb.com/mobiledoc' },
        (cookies) => {
          const cookiesWithSameSiteStrict = cookies.filter(
            (cookie) => cookie.sameSite === 'strict'
          );
          sendResponse({
            sessionId: cookiesWithSameSiteStrict[0]?.value,
          });
        }
      );
    } else {
      sendResponse({});
    }
  });
};

const handleEnablement = async (request, sendResponse) => {
  const encryptedData = request?.data;
  if (encryptedData) {
    let content = {
      enablementKey: encryptedData,
    };
    try {
      let res = await checkEnablement(content);
      let envVars = await setEnvironmentVariables();
      envVars = envVars && JSON.parse(envVars);
      let websocketUrl = envVars?.WEBSOCKET_API_URL;
      if (!websocketUrl) res = await checkEnablement(content);
      if (res) {
        isenabled = true;
        await initWebSocket(myEmitter);
        customLogger();
        setTimeout(() => {
          let isConnected = checkWsConnection();
          if (isConnected) {
            initSentry(Sentry);
          }
        }, 2000);
        sendResponse(true);
      } else {
        sendResponse(false);
      }
    } catch (error) {
      console.error('ERROR IN handleEnablement', error);
      sendResponse(false);
    }
  } else {
    sendResponse(false);
  }
};

const handleSetIcon = (request) => {
  if (request?.iconPath) {
    try {
      downloadImageAndConvertToDataURL(request?.iconPath).then((dataUrl) => {
        chrome.action.setIcon({ path: dataUrl });
      });
    } catch (error) {
      console.log('ERROR IN SETICON');
    }
  }
};

const handleAuthSuccess = async (sendResponse) => {
  let tokenData = await databaseHandler(
    operationTypes.GET,
    dataName.TOKEN_DETAILS
  );
  if (tokenData) tokenData = JSON.parse(tokenData);
  provider_logout = false;
  let isConnected = checkWsConnection();
  if (isConnected) {
    initSentry(Sentry);
    customLogger();
  }
  if (!isConnected && tokenData)
    initWebSocket(myEmitter)
      .then((websocketdata) => {
        let isConnected = checkWsConnection();
        if (isConnected) {
          initSentry(Sentry);
          customLogger();
        }
        sendResponse(true);
      })
      .catch((error) => {
        sendResponse(false);
      });
};

const handleProviderLogout = () => {
  provider_logout = true;
  isSocketConnection = false;
  let isConnected = checkWsConnection();
  if (isConnected) {
    closeWsConnection();
  }
};

const handleCheckSocketConnection = async () => {
  let tokenData = await databaseHandler(
    operationTypes.GET,
    dataName.TOKEN_DETAILS
  );
  if (tokenData) tokenData = JSON.parse(tokenData);
  let isConnected = await checkWsConnection();
  if (tokenData && !isConnected && navigator.onLine) {
    provider_logout = false;
    initWebSocket(myEmitter);
    customLogger();
    let isConnected = await checkWsConnection();
    if (isConnected) initSentry(Sentry);
  }
};

const handleCallEncryptDecryptData = async (request) => {
  let extraData = {
    eventCode: request?.encryptedData?.eventCode,
    accountId: request?.encryptedData?.accountIdid,
    tenantId: request?.encryptedData?.tenantId,
    providerUsername: request?.encryptedData?.providerUsername,
    providerId: request?.encryptedData?.providerId,
    patientId: request?.encryptedData?.patientId,
    chartId: request?.encryptedData?.chartId,
    encounterId: request?.encryptedData?.encounterId,
  };
  let isconnected = await checkWsConnection();
  if (!_.isEqual(prevCtx, extraData)) {
    prevCtx = extraData;
    if (isconnected && request?.eventLaunchUrls) {
      console.log('SENDING USER_CONTEXT DATA TO SOCKET IN isconnected STATE');
      myEmitter.publish(wsEvents.USER_CONTEXT, request?.encryptedData);
    } else {
      setTimeout(async () => {
        if (request?.eventLaunchUrls) {
          console.log(
            'SENDING USER_CONTEXT DATA TO SOCKET IN else isconnected STATE'
          );
          myEmitter.publish(wsEvents.USER_CONTEXT, request?.encryptedData);
        }
      }, 8000);
    }
  }
};

const handlesendContainerLogs = (data) => {
  let isConnected = checkWsConnection();
  if (isConnected) {
    console.info(data);
  }
};

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.action) {
    case 'getSessionCookies':
      handleGetSessionCookies(sendResponse, request);
      return true;
    case 'handleEnblement':
      handleEnablement(request, sendResponse);
      return true;
    case 'setIcon':
      handleSetIcon(request);
      sendResponse(true);
      return true;
    case 'authSuccess':
      handleAuthSuccess(sendResponse);
      return true;
    case 'callEncryptDecryptData':
      handleCallEncryptDecryptData(request);
      return true;
    case 'ProviderLogout':
      handleProviderLogout();
      return true;
    case 'checkSocketConnection':
      isSocketConnection = true;
      return true;
    case 'sendAuditEvent':
      {
        let isConnected = checkWsConnection();
        if (isConnected)
          auditLogEventHandler(
            request?.event,
            request?.info,
            request?.networkId
          );
      }
      return true;
    case 'sendContainerLogs':
      handlesendContainerLogs(request?.data);
      return true;
    case 'handlePageUnload':
      prevCtx = {};
      return true;
    default:
      return false;
  }
});

const downloadImageAndConvertToDataURL = (url) => {
  return fetch(url)
    .then((response) => response.blob())
    .then((blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });
};

chrome.webRequest?.onHeadersReceived.addListener(
  function (details) {
    const responseHeaders = details.responseHeaders;
    const newResponseHeaders = [];

    for (let element of responseHeaders) {
      const header = element;
      if (
        header.name.toLowerCase() !== 'x-frame-options' &&
        header.name.toLowerCase() !== 'content-security-policy'
      ) {
        newResponseHeaders.push(header);
      }
    }

    return {
      responseHeaders: newResponseHeaders,
    };
  },
  {
    urls: [
      'https://*.babylonhealth.com/*',
      'https://*.babylonpartners.com/*',
      'https://*.babylontech.co.uk/*',
      'https://*.insiteflow.io/*',
      'https://ayu3wdzaxg.execute-api.us-east-1.amazonaws.com/dev/*',
    ],
    types: ['main_frame', 'sub_frame'],
  },
  ['responseHeaders']
);
