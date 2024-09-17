import { databaseHandler } from 'container-common/src/helpers/common-helper';
import { dataName, operationTypes } from 'container-common/src/helpers/constant';

let envVariableData = await databaseHandler(
  operationTypes.GET,
  dataName.ENVIRONMENT_VARIABLE
);

envVariableData = envVariableData && JSON.parse(envVariableData);
let API_PRACTICEFUSION_URL = envVariableData?.PRACTICEFUSION_API_URL;
let contextId;
const fetchJson = async (url, options) => {
  try {
    const response = await fetch(url, options);
    if (response.ok) {
      return response.json();
    }
  } catch (error) {}
};

const getProviderDetails = async (sessionToken) => {
  if (!API_PRACTICEFUSION_URL) {
    let envVariableData = await databaseHandler(
      operationTypes.GET,
      dataName.ENVIRONMENT_VARIABLE
    );
    envVariableData = envVariableData && JSON.parse(envVariableData);
    API_PRACTICEFUSION_URL = envVariableData?.PRACTICEFUSION_API_URL;
  }
  try {
    const providerAdContext = await fetchJson(
      `${API_PRACTICEFUSION_URL}/ChartingEndpoint/api/v2/ProviderAdContext`,
      { headers: { Authorization: `${sessionToken}` } }
    );

    const practiceUser = await fetchJson(
      `${API_PRACTICEFUSION_URL}/PracticeEndpoint/api/v1/practiceuser?providerGuid=${providerAdContext.providerGuid}`,
      { headers: { Authorization: `${sessionToken}` } }
    );

    return practiceUser?.practiceGuid;
  } catch (error) {}
};
export class PracticeFusionEhr {
  constructor(onUnloadCb) {
    this.onUnloadCb = onUnloadCb;
    this.registeredUnloadEvent = false;
  }

  discoverContext = async () => {
    const ctxData = { userDetails: {} };
    const sessionCookies = window.sessionStorage;

    ctxData['sessionId'] = sessionCookies?.sessionGUID || undefined;
    const sessionTimeOut = sessionCookies?.expirationDateTime || -1;

    if (ctxData.sessionId?.length === 0 || sessionTimeOut <= 0) {
      return { ctxData, sessionTimeOut };
    }

    const globalWrapper = document?.querySelector(
      '.application.navigation.ad-aware.ember-view'
    );
    if (globalWrapper) {
      ctxData.userDetails.providerId =
        sessionCookies?.providerGuid || undefined;
      ctxData.userDetails.accountId = sessionCookies?.practiceGuid || undefined;
      ctxData.userDetails.app = 'quickview';
      ctxData.userDetails.username = '';
      ctxData.tenantId = 'b070d4f0-1d92-446a-b3a1-875a317a3ca6';
      let patientNameElement = document.querySelector('.patient-info__name h3');
      let patientName = patientNameElement?.textContent?.trim();
      ctxData['firstname'] = patientName?.split(' ')[0];
      ctxData['lastname'] = patientName?.split(' ')[1];
      let dobElement = document.querySelector(
        '[data-element="patient-ribbon-dob"]'
      );
      let dob = dobElement?.textContent?.trim();
      ctxData['DOB']=dob
    }

    if (ctxData?.userDetails?.providerId?.length > 0) {
      ctxData['userDetails'] = {
        providerId: ctxData?.userDetails?.providerId,
        app: 'quickview',
      };
    }

    if (!ctxData?.userDetails?.username) {
      const providerUserName =
        document.querySelector('.provider-name')?.textContent ||
        document.querySelector('.provider-name')?.innerText;

      ctxData['userDetails'] = {
        ...ctxData['userDetails'],
        username: providerUserName,
      };
    }

    if (!ctxData.tenantId) {
      const departmentId = document
        ?.getElementById('Status')
        ?.contentDocument?.getElementById('DEPARTMENTID')?.value;
      ctxData['tenantId'] = departmentId;
    }

    const getPatientIdFromURL = () => {
      try {
        const patientIdMatch = RegExp(
          /(.*)\.practicefusion\.com\/(.*)\/patients\/(.*?)\//
        ).exec(window.location.href);
        if (patientIdMatch && patientIdMatch.length > 3 && patientIdMatch[3]) {
          return patientIdMatch[3];
        }
        return '';
      } catch (error) {
        return '';
      }
    };

    const sessionToken = sessionCookies?.sessionGUID;

    if (!contextId) {
      contextId = await getProviderDetails(sessionToken);
    }
    ctxData['userDetails'] = {
      ...ctxData['userDetails'],
      context_id: contextId,
    };
    const patientId = getPatientIdFromURL();
    ctxData['patientId'] = patientId;

    const chartTableId = document?.getElementsByClassName(
      'data-table data-table--flex timeline-table--v2 type-v2 ember-view'
    );
    if (chartTableId.length > 0) {
      ctxData['chartId'] = patientId;
    } else {
      ctxData['chartId'] = undefined;
    }

    const patientEncounterCode = document
      .querySelector('[data-element="code-type-and-code-value"]')
      ?.textContent.trim();
    ctxData['encounterId'] = patientEncounterCode;

    return { ctxData, sessionTimeOut };
  };

  domLoaded = async () => {
    return new Promise((resolvePromise, rejectPromise) => {
      const globalWrapper = document?.querySelector(
        '.application.navigation.ad-aware.ember-view'
      );
      if (globalWrapper) {
        if (!this.registeredUnloadEvent) {
          globalWrapper?.addEventListener('beforeunload', async () => {
            await setTimeout(this.onUnloadCb, 100);
          });
          this.registeredUnloadEvent = true;
        }

        resolvePromise(true);
      } else {
        resolvePromise(false);
      }
    });
  };
}
