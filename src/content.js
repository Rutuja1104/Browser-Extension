import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './assets/styles/content.css';
import _ from 'underscore';
import Draggable from './components/Draggable';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { SystemFactory } from './integration/ehr/system-factory';
import {
  CONTEXT_EXPIRED,
  GET_NOTIFICATION_DATA_FOR_USER_CONTEXT,
  NOTIFICATION_ACKNOWLEDGED,
  NOTIFICATION_DISMISSED,
  NOTIFICATION_DISPLAYED,
  NOTIFICATION_SKIPPED,
  SYSTEM_URL_REGEXP,
  USER_CONTEXT,
  VIEWPORT_CLOSED,
  VIEWPORT_MAXIMISED,
  VIEWPORT_MINIMISED,
  VIEWPORT_OPENED,
  VIEWPORT_QUITED,
  VIEWPORT_SWITCHED,
} from './framework/constants';
import {
  databaseHandler,
  initCommonInstance,
  initMixpanel,
  sendToMixpanel,
} from 'container-common/src/helpers/common-helper';
import {
  operationTypes,
  dataName,
} from 'container-common/src/helpers/constant';
import Viewport from 'container-common/src/components/Viewport';
import Toast from 'container-common/src/components/Toast';
import mixpanel from 'mixpanel-browser';

initCommonInstance('browser', chrome);
let previousNetworkArray = '';

const ContextEvent = Object.freeze({
  ProviderLogin: 'provider_login',
  ProviderLogout: 'provider_logout',
  ProviderView: 'provider_view',
  PatientView: 'patient_view',
  PatientChartView: 'patient_chart_view',
  PatientEncounterView: 'patient_encounter_view',
});

const Container = ({ networkId }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOpenViewport, setIsOpenViewport] = useState(true);
  const [launchURL, setLaunchURL] = useState('');
  const [ctx, setCtx] = useState({ data: {}, eventCode: '' });
  const [configDetails, setConfigDetails] = useState({});
  const [showToast, setShowToast] = useState(true);
  const [isValidContext, setIsValidContext] = useState(false);
  const [alertShown, setAlertShown] = useState(false);
  const [isNotificationSkipped, setIsNotificationSkipped] = useState(false);
  const [stateChanged, setStateChanged] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState({});
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [domContext, setDomContext] = useState({});
  const [checkPrevCtx, setCheckPrevCtx] = useState({});
  const prevCtxRef = useRef();
  const domContextRef = useRef();
  const configRef = useRef();
  const validContextRef = useRef();
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const [counts, setCounts] = useState('');
  const [timeoutId, setTimeoutId] = useState(null);
  const [eventExpiryTimeout, setEventExpiryTimeout] = useState(null);
  const [eventExpired, setEventExpired] = useState(false);
  const [viewPortConfig, setViewPortConfig] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [configUpdated, setconfigUpdated] = useState(false);
  const [toastConfig, setToastConfig] = useState({});

  const system = new SystemFactory();
  const ehr = system.getSystem(networkId);
  initCommonInstance('browser', chrome);

  const sendContainerLogs = (eventName, data) => {
    let payload = {
      eventName: eventName,
      ctx: data,
    };
    chrome.runtime.sendMessage({ action: 'sendContainerLogs', data: payload });
  };

  const handleClose = () => {
    setShowToast(false);
    sendContainerLogs('NOTIFICATION_DISMISSED', networkId);
    sendAuditEvent(NOTIFICATION_DISMISSED, networkId);
    sendMixpanelEvent('NOTIFICATION_DISMISSED', {
      eventName: 'NOTIFICATION_DISMISSED',
    });
  };

  const handleIconClicked = () => {
    setBlinking(false);
    if (isContentLoaded) resetTimer();
  };

  const sendMixpanelEvent = (eventName, data) => {
    sendToMixpanel(eventName, data);
  };

  const discoverContext = async () => {
    const { ctxData, sessionTimeOut } = (await ehr?.discoverContext()) || {};
    setDomContext({ ctxData: ctxData, sessionTimeOut: sessionTimeOut });
    return { ctxData, sessionTimeOut };
  };

  const updateState = (data, eventCode) => {
    setCtx({ data: data, eventCode: eventCode });
  };

  const performUserContext = async (cfg, contentLoaded) => {
    const { ctxData, sessionTimeOut } = await discoverContext();
    if (
      ctxData?.sessionId?.length === 0 ||
      sessionTimeOut <= 0 ||
      !contentLoaded
    ) {
      updateState(ctxData, ContextEvent.ProviderLogout);
      setIsLoggedIn(false);
      chrome.runtime.sendMessage({ action: 'ProviderLogout' });
    }

    const validContext = isValidContextForConfig(ctxData, cfg);
    if (validContext && contentLoaded) {
      setIsLoggedIn(true);
      if (ctxData?.encounterId?.length > 0) {
        updateState(ctxData, ContextEvent?.PatientEncounterView);
      } else if (ctxData?.chartId?.length > 0) {
        updateState(ctxData, ContextEvent?.PatientChartView);
      } else if (ctxData?.patientId?.length > 0) {
        updateState(ctxData, ContextEvent?.PatientView);
      } else if (ctxData?.userDetails?.username?.length > 0) {
        updateState(ctxData, ContextEvent?.ProviderView);
      } else {
        sendAuditEvent(VIEWPORT_OPENED, networkId);
        sendContainerLogs(VIEWPORT_OPENED);
        updateState(ctxData, ContextEvent?.ProviderLogin);
      }
    }
  };

  const resetTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setEventExpired(false);
    }

    const newTimeoutId = setTimeout(() => {
      if (
        !configDetails.layout?.viewport?.alwaysOn &&
        configDetails?.networkId === networkId
      ) {
        setAlwaysOn(false);
      }
      setBlinking(false);
      setShowToast(false);
      setIsOpenViewport(false);
      setEventExpired(true);
      if (eventExpired) {
        sendAuditEvent(CONTEXT_EXPIRED, 'Context Expired', networkId);
      }
      sendMixpanelEvent('CONTEXT_EXPIRED', {
        eventName: 'CONTEXT_EXPIRED',
      });
      setCounts(0);
      databaseHandler(operationTypes.SET, 'counts' + networkId, '0');

      setLaunchURL('');
    }, eventExpiryTimeout * 1000);

    setTimeoutId(newTimeoutId);
  };

  const setTimer = () => {
    setShowToast(true);
    getCount();
  };

  const checkNotificationSkipped = (data) => {
    if (data === 'notificationSkipped') {
      return (
        configDetails?.layout?.notifications?.enabled &&
        configDetails?.data?.workflow?.supportedMethods[0]?.contextEvents?.includes(
          ctx?.eventCode
        ) &&
        isOpenViewport
      );
    } else if (data === 'stateChanged') {
      return (
        configDetails?.layout?.notifications?.enabled &&
        configDetails?.data?.workflow?.supportedMethods[0]?.contextEvents?.includes(
          ctx?.eventCode
        )
      );
    }
  };

  useEffect(() => {
    const handleReload = () => {
      chrome.runtime.sendMessage({
        action: 'handlePageUnload',
      });
    };

    window.addEventListener('beforeunload', handleReload);
    (async () => {
      const configData = await databaseHandler(
        operationTypes.GET,
        `configData_${networkId}`
      );
      let cfg = configData && JSON.parse(configData);
      if (cfg?.networkId === networkId) {
        initMixpanel(mixpanel);
        setConfigDetails(cfg);
        let viewportConfig = {
          alwaysOn: cfg?.layout?.viewport?.alwaysOn,
          showCounts: cfg?.layout?.viewport?.showCounts,
          counts: counts,
          tabWidthWithViewport:
            cfg?.layout?.viewport?.properties?.tabWidthWithViewport,
          tabHeightWithoutViewport:
            cfg?.layout?.viewport?.properties?.tabHeightWithoutViewport,
          tabWidthWithoutViewport:
            cfg?.layout?.viewport?.properties?.tabWidthWithoutViewport,
          tabHeightWithViewport:
            cfg?.layout?.viewport?.properties?.tabHeightWithViewport,
          tabBackgroundColor:
            cfg?.layout.viewport.properties.tabBackgroundColor,
          viewportWidth: cfg?.layout.viewport.properties.viewportWidth + 'px',
          viewportHeight: cfg?.layout.viewport.properties.viewportHeight + 'px',
          icon: cfg?.layout.viewport.properties.icon,
          networkId: cfg?.networkId,
          eventExpiryTimeout: cfg?.eventExpiryTimeout,
        };
        setViewPortConfig(viewportConfig);
        let toastConfigData = {
          width: cfg?.layout?.notifications?.properties?.width,
          height: cfg?.layout?.notifications?.properties?.height,
          color: cfg?.layout?.notifications?.properties?.color,
          backgroundColor:
            cfg?.layout?.notifications?.properties?.backgroundColor,
          fontSize: '12px',
        };
        setToastConfig(toastConfigData);
      }
      if (isContentLoaded) {
        resetTimer();
        performUserContext(viewPortConfig, isContentLoaded);
      }
    })();
  }, []);

  useEffect(() => {
    if (
      isLoggedIn &&
      prevCtxRef.current &&
      !_.isEqual(ctx, prevCtxRef.current)
    ) {
      if (isContentLoaded) createLaunchToken();
      sendAuditEvent(VIEWPORT_SWITCHED, ctx?.eventCode, networkId);
      sendContainerLogs('VIEWPORT_SWITCH', ctx);
      if (!isOpenViewport) setBlinking(true);
      if (eventExpired) setTimer();
      if (isContentLoaded) resetTimer();
      if (checkNotificationSkipped('notificationSkipped')) {
        setIsNotificationSkipped(true);
      } else {
        setIsNotificationSkipped(false);
      }
      if (checkNotificationSkipped('stateChanged')) {
        setStateChanged(!stateChanged);
      }
    }
    prevCtxRef.current = ctx;
  }, [ctx]);

  useEffect(() => {
    if (
      !validContextRef.current &&
      isValidContext !== validContextRef.current
    ) {
      sendAuditEvent(VIEWPORT_CLOSED, 'invalid validContext', networkId);
    }
    validContextRef.current = isValidContext;
  }, [isValidContext]);

  useEffect(() => {
    if (configRef.current && !_.isEqual(viewPortConfig, configRef.current)) {
      updateViewportWithNotification(viewPortConfig);
    }
    configRef.current = viewPortConfig;
  }, [viewPortConfig]);

  useEffect(() => {
    if (
      domContextRef.current &&
      !_.isEqual(domContext, domContextRef.current)
    ) {
      performUserContext(viewPortConfig, isContentLoaded);
    }
    domContextRef.current = domContext;
  }, [domContext]);

  useEffect(() => {
    if (isNotificationSkipped) {
      setShowToast(false);
      sendAuditEvent(NOTIFICATION_SKIPPED, networkId);
      sendContainerLogs('NOTIFICATION_SKIPPED', networkId);
      sendMixpanelEvent('NOTIFICATION_SKIPPED', {
        eventName: 'NOTIFICATION_SKIPPED',
      });
    } else if (
      configDetails?.layout?.notifications?.enabled &&
      configDetails?.data?.workflow?.supportedMethods[0]?.contextEvents?.includes(
        ctx?.eventCode
      ) &&
      !isOpenViewport
    ) {
      setShowToast(true);
      resetTimer();
      sendAuditEvent(NOTIFICATION_DISPLAYED, networkId);
      sendContainerLogs('NOTIFICATION_DISPLAYED', networkId);
      setBlinking(false);
      if (
        alwaysOn &&
        configDetails?.layout?.viewport?.alwaysOn === false &&
        configUpdated
      ) {
        setAlwaysOn(false);
      }
      sendMixpanelEvent('NOTIFICATION_DISPLAYED', {
        eventName: 'NOTIFICATION_DISPLAYED',
      });
    }
  }, [isNotificationSkipped, stateChanged]);

  const sendAuditEvent = (auditEvent, auditInfo, networkId) => {
    if (isContentLoaded) {
      chrome.runtime.sendMessage({
        action: 'sendAuditEvent',
        event: auditEvent,
        info: auditInfo,
        networkId: networkId,
      });
    }
  };

  const toggleViewport = () => {
    setBlinking(false);
    if (isContentLoaded) resetTimer();
    if (!isOpenViewport) {
      sendAuditEvent(VIEWPORT_MAXIMISED, networkId);
      sendContainerLogs('VIEWPORT_MAXIMISE');
      sendMixpanelEvent('VIEWPORT_MAXIMISED', {
        eventName: 'VIEWPORT_MAXIMISED',
      });
    } else {
      sendAuditEvent(VIEWPORT_MINIMISED, networkId);
      sendContainerLogs('VIEWPORT_MINIMISE');
      sendMixpanelEvent('VIEWPORT_MINIMISED');
    }

    setIsOpenViewport(!isOpenViewport);
  };

  const getEhrName = () => {
    let url = window?.location?.href;
    if (RegExp(SYSTEM_URL_REGEXP.athenaNet).exec(url)) {
      return 'athena';
    } else if (RegExp(SYSTEM_URL_REGEXP.practiceFusion).exec(url)) {
      return 'practiceFusion';
    } else if (RegExp(SYSTEM_URL_REGEXP.openEmr).exec(url)) {
      return 'openemr';
    } else if (RegExp(SYSTEM_URL_REGEXP.eclinicalweb).exec(url)) {
      return 'eclinicalweb';
    } else {
      return null;
    }
  };

  const createLaunchToken = async () => {
    const ehr = getEhrName();
    const now = Date.now();
    const usersData = {
      trigger: 'ehr_user_activity',
      eventCode: ctx?.eventCode,
      accountId: ctx?.data?.userDetails?.context_id,
      tenantId: ctx?.data?.tenantId,
      providerUsername: ctx?.data?.userDetails?.username,
      providerId: ctx?.data?.userDetails?.providerId,
      patientId: ctx?.data?.patientId ? ctx?.data?.patientId : undefined,
      mrn: ctx?.data?.patientId,
      firstname: ctx?.data?.firstname,
      lastname: ctx?.data?.lastname,
      DOB: ctx?.data?.DOB,
      ehr: ehr,
      chartId:
        /^\d+$/.test(ctx?.data?.chartId) && ctx?.data?.patientId
          ? ctx?.data?.chartId
          : undefined,
      encounterId:
        /^\d+$/.test(ctx?.data?.encounterId) && ctx?.data?.patientId
          ? ctx?.data?.encounterId
          : undefined,
      section: ctx?.data?.userDetails?.app,
      ts: now,
    };
    let extraData = {
      trigger: 'ehr_user_activity',
      eventCode: ctx?.eventCode,
      accountId: ctx?.data?.userDetails?.context_id,
      tenantId: ctx?.data?.tenantId,
      providerUsername: ctx?.data?.userDetails?.username,
      providerId: ctx?.data?.userDetails?.providerId,
      patientId: ctx?.data?.patientId ? ctx?.data?.patientId : undefined,
      chartId:
        /^\d+$/.test(ctx?.data?.chartId) && ctx?.data?.patientId
          ? ctx?.data?.chartId
          : undefined,
      encounterId:
        /^\d+$/.test(ctx?.data?.encounterId) && ctx?.data?.patientId
          ? ctx?.data?.encounterId
          : undefined,
    };
    if (!_.isEqual(checkPrevCtx, extraData)) {
      console.log(
        'USER_CONTEXT : [SENDING USER CONTEXT]',
        networkId,
        extraData.eventCode
      );
      setCheckPrevCtx(extraData);
      chrome.runtime.sendMessage({
        action: 'callEncryptDecryptData',
        encryptedData: usersData,
        operation: 'ENCRYPT',
        event: USER_CONTEXT,
        eventLaunchUrls: configDetails?.launch?.eventLaunchUrls[ctx.eventCode],
      });
    }
  };

  /**
   * Check if the config is correctly setup to parse the known system
   *
   * @param {*} cfg
   * @returns
   */

  const isValidConfigForSystem = (cfg) => {
    const configDataFound = cfg && Object.keys(cfg)?.length > 0;
    const knownSystem =
      cfg?.data?.allowedContext?.system?.name?.length > 0 &&
      SYSTEM_URL_REGEXP.hasOwnProperty(cfg?.data?.allowedContext?.system?.name);
    const urlMatch =
      RegExp(SYSTEM_URL_REGEXP[cfg?.data?.allowedContext?.system?.name]).exec(
        window.location.origin
      )?.length > 0;

    return configDataFound && knownSystem && urlMatch;
  };

  /**
   * Check if the passed in context data and config are valid and in parity with each other
   *
   * @param {*} ctxData
   * @param {*} cfg
   * @returns
   */
  const isValidContextForConfig = (ctxData, cfg) => {
    const ctxDataFound = ctxData && Object.keys(ctxData)?.length > 0;
    const launchURLsDefined =
      Object.keys(cfg?.launch?.eventLaunchUrls || {})?.length > 0;
    const validAccount =
      cfg?.data?.allowedContext?.accountId &&
      cfg?.data?.allowedContext?.accountId === ctxData?.userDetails?.context_id;
    const validTenant =
      !cfg?.data?.allowedContext?.tenantIds ||
      cfg?.data?.allowedContext?.tenantIds?.length === 0 ||
      cfg?.data?.allowedContext?.tenantIds.includes(ctxData?.tenantId);
    const validProvider =
      !cfg?.data?.allowedContext?.providerIds ||
      cfg?.data?.allowedContext?.providerIds?.length === 0 ||
      cfg?.data?.allowedContext?.providerIds.includes(
        ctxData?.userDetails?.providerId
      );

    return (
      ctxDataFound &&
      launchURLsDefined &&
      validAccount &&
      validTenant &&
      validProvider
    );
  };

  const handleTemplate = (template) => {
    if (template?.includes('?')) {
      return '?';
    } else if (template?.includes('#')) {
      return '#';
    }
  };
  useEffect(() => {
    if (alertShown) {
      sendAuditEvent(VIEWPORT_QUITED, networkId);
    }
  }, [alertShown]);

  useEffect(() => {
    (async () => {
      const configData = await databaseHandler(
        operationTypes.GET,
        `configData_${networkId}`
      );
      let cfg = configData && JSON.parse(configData);
      let viewportConfig = {
        alwaysOn: alwaysOn,
        showCounts: cfg?.layout?.viewport?.showCounts,
        counts: counts,
        tabWidthWithViewport:
          cfg?.layout?.viewport?.properties?.tabWidthWithViewport,
        tabHeightWithoutViewport:
          cfg?.layout?.viewport?.properties?.tabHeightWithoutViewport,
        tabWidthWithoutViewport:
          cfg?.layout?.viewport?.properties?.tabWidthWithoutViewport,
        tabHeightWithViewport:
          cfg?.layout?.viewport?.properties?.tabHeightWithViewport,
        tabBackgroundColor: cfg?.layout.viewport.properties.tabBackgroundColor,
        viewportWidth: cfg?.layout.viewport.properties.viewportWidth + 'px',
        viewportHeight: cfg?.layout.viewport.properties.viewportHeight + 'px',
        icon: cfg?.layout.viewport.properties.icon,
        networkId: cfg?.networkId,
        eventExpiryTimeout: cfg?.eventExpiryTimeout,
      };
      setViewPortConfig(viewportConfig);
    })();
  }, [alwaysOn]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      (async () => {
        const contentLoaded = await ehr.domLoaded();
        setIsContentLoaded(contentLoaded);
        const { validConfig, cfg } = (await getUpdatedConfig()) || {};
        if (validConfig) {
          await performUserContext(cfg, contentLoaded);
        }
        if (contentLoaded) {
          chrome.runtime.sendMessage({ action: 'checkSocketConnection' });
        }
        if (cfg?.eventExpiryTimeout) {
          setEventExpiryTimeout(cfg?.eventExpiryTimeout);
        } else {
          setEventExpiryTimeout(600);
        }
        checkLoacalStorage();
      })();
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const checkLoacalStorage = () => {
    chrome.runtime.onMessage.addListener(function (message) {
      if (message?.action === 'localStorageEmpty') {
        setIsLoggedIn(false);
        setAlertShown(true);
      }
    });
  };

  const handleMessageContainer = () => {
    if (isContentLoaded) resetTimer();
    if (!alwaysOn) setAlwaysOn(true);
    toggleViewport();
    setShowToast(false);
    sendAuditEvent(NOTIFICATION_ACKNOWLEDGED, networkId);
    sendContainerLogs('NOTIFICATION CLICKED');
    sendMixpanelEvent('NOTIFICATION_ACKNOWLEDGED', {
      eventName: NOTIFICATION_ACKNOWLEDGED,
    });
  };

  const getCount = async () => {
    const countsData = await databaseHandler(
      operationTypes.GET,
      'counts' + networkId
    );
    if (countsData) {
      const counts = JSON.parse(countsData);
      if (counts) setCounts(counts);
    } else {
      setCounts(0);
    }
  };

  const getUpdatedConfig = async () => {
    const configData = await databaseHandler(
      operationTypes.GET,
      `configData_${networkId}`
    );
    let cfg = configData && JSON.parse(configData);
    const validConfig = isValidConfigForSystem(cfg);
    if (!_.isEqual(cfg, configDetails) && cfg?.networkId === networkId) {
      await setConfigDetails(cfg);
      return { validConfig, cfg };
    }
  };

  const updateViewportWithNotification = async (cfg) => {
    chrome.runtime.sendMessage({
      action: 'setIcon',
      iconPath: cfg?.layout?.viewport?.properties?.icon,
    });
  };

  const handleConfig = async (data) => {
    console.log('configUpdated handleConfig', configUpdated);
    const config = JSON.parse(data);
    if (config?.networkId === networkId) {
      const { ctxData, sessionTimeOut } = await discoverContext();
      setDomContext({ ctxData: ctxData, sessionTimeOut: sessionTimeOut });
      let viewportConfig = {
        alwaysOn: alwaysOn,
        showCounts: config?.layout?.viewport?.showCounts,
        count: counts,
        tabWidthWithViewport:
          config?.layout?.viewport?.properties?.tabWidthWithViewport,
        tabHeightWithoutViewport:
          config?.layout?.viewport?.properties?.tabHeightWithoutViewport,
        tabWidthWithoutViewport:
          config?.layout?.viewport?.properties?.tabWidthWithoutViewport,
        tabHeightWithViewport:
          config?.layout?.viewport?.properties?.tabHeightWithViewport,
        tabBackgroundColor:
          config?.layout.viewport.properties.tabBackgroundColor,
        viewportWidth: config?.layout.viewport.properties.viewportWidth + 'px',
        viewportHeight:
          config?.layout.viewport.properties.viewportHeight + 'px',
        icon: config?.layout.viewport.properties.icon,
        networkId: config?.networkId,
        eventExpiryTimeout: config?.eventExpiryTimeout,
        fromNotification: configDetails?.fromNotification,
      };
      setViewPortConfig(viewportConfig);
      let toastConfigData = {
        width: config?.layout?.notifications?.properties?.width,
        height: config?.layout?.notifications?.properties?.height,
        color: config?.layout?.notifications?.properties?.color,
        backgroundColor:
          config?.layout?.notifications?.properties?.backgroundColor,
        fontSize: '12px',
      };
      setToastConfig(toastConfigData);
      let validConfigForSystem = config && isValidConfigForSystem(config);
      let validContext = ctxData && isValidContextForConfig(ctxData, config);
      setIsValidContext(validContext);
      if (validConfigForSystem) {
        if (!_.isEqual(config, configDetails)) {
          chrome.runtime.onMessage.addListener(function (
            message,
            sender,
            sendResponse
          ) {
            sendResponse(true);
          });
          setConfigDetails(config);
          // if (configUpdated) {
          console.log(
            'INSIDE config?.layout?.viewport?.alwaysOn',
            config?.layout?.viewport?.alwaysOn
          );
          setAlwaysOn(config?.layout?.viewport?.alwaysOn);
          // };
          if (!config?.layout?.viewport?.alwaysOn)
            await setIsOpenViewport(false);
          console.info('INFO EVENT [Applying Updated config]');
        }
      } else if (!validConfigForSystem) {
        console.error('ERROR EVENT : [CONFIG IS NOT SETUP FOR THE SYSTEM]');
      } else if (!validContext) {
        console.error('ERROR EVENT : [CONFIG IS NOT FOR THE CURRENT CONTEXT]');
      }
      if (config?.eventExpiryTimeout) {
        setEventExpiryTimeout(config?.eventExpiryTimeout);
      } else {
        setEventExpiryTimeout(600);
      }
    }
  };

  const handleContainerLaunch = async (data) => {
    const notificationDetails = JSON.parse(data);
    if (
      notificationDetails?.networkId === networkId ||
      ctx.eventCode === notificationDetails?.eventCode
    ) {
      if (
        configDetails &&
        configDetails?.layout?.viewport?.alwaysOn === false &&
        !alwaysOn &&
        notificationDetails?.networkId === networkId
      ) {
        if (
          configDetails?.layout?.notifications?.enabled &&
          configDetails?.data?.workflow?.supportedMethods[0]?.contextEvents?.includes(
            ctx?.eventCode
          ) &&
          configUpdated
        ) {
          setAlwaysOn(false);
        } else {
          setAlwaysOn(true);
        }
      }
      chrome.runtime.onMessage.addListener(function (
        message,
        sender,
        sendResponse
      ) {
        sendResponse(true);
      });
      let notificationData =
        notificationDetails['get-notification-data-for-user-context'];
      let notification = notificationData?.notifications;
      setNotificationDetails(notification);

      if (notificationDetails?.launchToken) {
        let processTemplate = handleTemplate(
          configDetails?.launch?.eventLaunchUrls?.template
        );
        let newLaunchUrl =
          configDetails?.launch?.eventLaunchUrls[ctx.eventCode] || '';
        newLaunchUrl =
          newLaunchUrl +
          processTemplate +
          `token=${notificationDetails?.launchToken}`;
        console.log('newLaunchUrl', newLaunchUrl);
        if (newLaunchUrl) setLaunchURL(newLaunchUrl);
      }

      if (notificationDetails?.count) {
        databaseHandler(
          operationTypes.SET,
          'counts' + networkId,
          notificationDetails?.count
        );
        setCounts(notificationDetails?.count);
      } else if (notificationDetails['get-counts-for-user-context']) {
        databaseHandler(
          operationTypes.SET,
          'counts' + networkId,
          notificationDetails['get-counts-for-user-context']?.count
        );
        setCounts(notificationDetails['get-counts-for-user-context']?.count);
      } else {
        setCounts(0);
      }
    }
  };

  const handleNotification = async (data) => {
    const notificationDetails = JSON.parse(data);
    if (
      notificationDetails?.networkId === networkId &&
      ctx.eventCode === notificationDetails?.eventCode
    ) {
      if (
        configDetails &&
        configDetails?.layout?.viewport?.alwaysOn === false &&
        !alwaysOn &&
        notificationDetails?.networkId === networkId
      ) {
        if (
          configDetails?.layout?.notifications?.enabled &&
          configDetails?.data?.workflow?.supportedMethods[0]?.contextEvents?.includes(
            ctx?.eventCode
          ) &&
          configUpdated
        ) {
          setAlwaysOn(false);
        } else {
          setAlwaysOn(true);
        }
      }
      chrome.runtime.onMessage.addListener(function (
        message,
        sender,
        sendResponse
      ) {
        sendResponse(true);
      });
      let notificationData =
        notificationDetails['get-notification-data-for-user-context'];
      let notification = notificationData?.notifications;
      setNotificationDetails(notification);

      if (notificationDetails?.launchToken) {
        let processTemplate = handleTemplate(
          configDetails?.launch?.eventLaunchUrls?.template
        );
        let newLaunchUrl =
          configDetails?.launch?.eventLaunchUrls[ctx.eventCode] || '';
        newLaunchUrl =
          newLaunchUrl +
          processTemplate +
          `token=${notificationDetails?.launchToken}`;
        console.log('newLaunchUrl', newLaunchUrl);
        if (newLaunchUrl) setLaunchURL(newLaunchUrl);
      }
      if (notificationDetails?.count) {
        databaseHandler(
          operationTypes.SET,
          'counts' + networkId,
          notificationDetails?.count
        );
        setCounts(notificationDetails?.count);
      } else if (notificationDetails['get-counts-for-user-context']) {
        databaseHandler(
          operationTypes.SET,
          'counts' + networkId,
          notificationDetails['get-counts-for-user-context']?.count
        );
        setCounts(notificationDetails['get-counts-for-user-context']?.count);
      } else {
        setCounts(0);
      }
    }
  };

  chrome.runtime.onMessage.addListener(async function (message) {
    if (message?.action === 'updated-config') {
      setconfigUpdated(true);
      await handleConfig(message?.data);
    }
    if (message?.action === 'container-launch') {
      await setconfigUpdated(false);
      handleContainerLaunch(message?.data);
    }
    if (message?.action === 'show-notification') {
      await setconfigUpdated(false);
      handleNotification(message?.data);
    }
  });

  return (
    <>
      {configDetails?.layout?.notifications?.enabled &&
        configDetails?.data?.workflow?.supportedMethods?.some(
          (item) => item.name === GET_NOTIFICATION_DATA_FOR_USER_CONTEXT
        ) &&
        configDetails?.data?.workflow?.supportedMethods[0]?.contextEvents?.includes(
          ctx?.eventCode
        ) &&
        !isOpenViewport &&
        (notificationDetails?.title || notificationDetails?.description) &&
        isLoggedIn &&
        isContentLoaded &&
        configDetails?.launch?.eventLaunchUrls[ctx.eventCode] && (
          <Draggable
            type={`toast+${networkId}`}
            displayHeight={toastConfig.height}
            displayWidth={toastConfig.width}
          >
            <div className="toastContainer show">
              <Toast
                type="browser"
                showToast={showToast}
                handleToastAck={handleMessageContainer}
                handleToastClose={handleClose}
                toastConfig={toastConfig}
                toastContext={notificationDetails}
              />
            </div>
          </Draggable>
        )}
      {isLoggedIn &&
        alwaysOn &&
        isContentLoaded &&
        configDetails?.launch?.eventLaunchUrls[ctx.eventCode] && (
          <Draggable
            type={`viewport+${networkId}`}
            displayHeight={
              isOpenViewport
                ? viewPortConfig?.viewportHeight
                : parseInt(viewPortConfig?.tabHeightWithoutViewport) +
                  parseInt(155)
            }
            displayWidth={
              isOpenViewport
                ? viewPortConfig?.viewportWidth
                : viewPortConfig?.tabWidthWithoutViewport
            }
          >
            <div className="viewportContainer show">
              <Viewport
                type="browser"
                viewPortContent={{ url: launchURL, count: counts ? counts : 0 }}
                viewPortConfig={viewPortConfig}
                toggleViewport={toggleViewport}
                blinking={blinking}
                handleIconClicked={handleIconClicked}
                viewportState={isOpenViewport}
                ctx={ctx}
              />
            </div>
          </Draggable>
        )}
    </>
  );
};
const isPopup = document?.getElementById('insiteflow-extension-popup');

if (!isPopup) {
  let networkIdPayloadArrayData = await databaseHandler(
    operationTypes.GET,
    dataName.NETWORKS
  );
  let networkIds;
  const toastapp = document.createElement('div');
  toastapp.id = `insiteflow-extension-root-toast-container`;
  document.body.prepend(toastapp);
  if (networkIdPayloadArrayData)
    networkIds = JSON.parse(networkIdPayloadArrayData);
  networkIds?.forEach(async (id) => {
    const app = document.createElement('div');
    app.id = `insiteflow-extension-root-${id}`;
    const configData = await databaseHandler(operationTypes.GET, id);
    let cfg;
    if (configData) cfg = JSON.parse(configData);
    app.style = cfg?.layout?.viewport?.properties?.rootStyle;
    app.className = 'insiteflow-extension_popup';
    document.body.prepend(app);
    app.className = 'insiteflow-extension-root';
    ReactDOM.createRoot(
      document.getElementById(`insiteflow-extension-root-${id}`)
    ).render(<Container networkId={id} />);
  });
}

const isElementRendered = (id) => {
  return document.getElementById(`insiteflow-extension-root-${id}`) !== null;
};

const renderContainers = async (networkIds) => {
  await Promise.all(
    networkIds.map(async (id) => {
      document
        .querySelectorAll('.insiteflow-extension-root')
        .forEach((container) => {
          if (!networkIds.includes(container.dataset.networkId)) {
            container.remove();
          }
        });
      if (!isElementRendered(id)) {
        const app = document.createElement('div');
        app.id = `insiteflow-extension-root-${id}`;
        app.dataset.networkId = id;
        const configData = await databaseHandler(operationTypes.GET, id);
        let cfg;
        if (configData) cfg = JSON.parse(configData);

        app.style = cfg?.layout?.viewport?.properties?.rootStyle;
        app.className = 'insiteflow-extension_popup';
        document.body.prepend(app);
        app.className = 'insiteflow-extension-root';

        ReactDOM.createRoot(
          document.getElementById(`insiteflow-extension-root-${id}`)
        ).render(<Container networkId={id} />);
      }
    })
  );
};

const getUpdatedNetworkIds = async () => {
  const networkIdPayloadArrayData = await databaseHandler(
    operationTypes.GET,
    dataName.NETWORKS
  );
  let networkIds;
  if (networkIdPayloadArrayData) {
    networkIds = JSON.parse(networkIdPayloadArrayData);
  }
  if (JSON.stringify(previousNetworkArray) !== JSON.stringify(networkIds)) {
    previousNetworkArray = networkIds;
    return true;
  } else {
    return false;
  }
};

const updateUI = async () => {
  const isNetworkArrayChange = await getUpdatedNetworkIds();
  if (isNetworkArrayChange) {
    const networkIdPayloadArrayData = await databaseHandler(
      operationTypes.GET,
      dataName.NETWORKS
    );
    let networkIds;
    if (networkIdPayloadArrayData) {
      networkIds = JSON.parse(networkIdPayloadArrayData);
    }
    if (networkIds) {
      await renderContainers(networkIds);
    }
  }
};
chrome.runtime.onMessage.addListener(function (message) {
  if (message?.action === 'localStorageEmpty') {
    const a = document.getElementById(
      `insiteflow-extension-root-toast-container`
    );
    console.log('LOCAL STORAGE EMPTY MESSAGE:::::::::::::::', a);
    ReactDOM.createRoot(
      document.getElementById(`insiteflow-extension-root-toast-container`)
    ).render(<ToastContainer />);
    toast.error('Please Enter Enablement Key!', {
      autoClose: 10000,
      style: {
        top: '50px',
      },
    });
  }
});

setInterval(updateUI, 2000);

export default Container;
