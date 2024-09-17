
export class OpenEmrEhr {
  constructor(onUnloadCb) {
    this.onUnloadCb = onUnloadCb;
    this.registeredUnloadEvent = false;
  }
  discoverContext = () => {
    const ctxData = { userDetails: {} };
    ctxData['sessionId'] =
      (document.cookie.split('=')[1] &&
        document.querySelector('#logoutinnerframe')) ||
      undefined;
    const sessionTimeOut =
      document.cookie.split('=')[1] && document.querySelector('#authUser')
        ? 0
        : undefined;
        let firstName = document.querySelector('[data-bind="text:fname"]')?.textContent;
        let lastName = document.querySelector('[data-bind="text:lname"]')?.textContent;
        let fullName = firstName + ' ' + lastName;
        if(fullName)ctxData['userDetails']['providerId'] = fullName;
        ctxData['userDetails']['context_id'] = window.location.href.split('.').reverse()[2];
        let patientEncounterCode = document?.querySelector('span[data-bind="text:selectedEncounter().id()"]')?.textContent.trim();
        ctxData['encounterId'] = patientEncounterCode;
        let patientName = document.querySelector('.ptName span')?.textContent.trim();
        let patientId = document.querySelector('.ptName small span')?.textContent.trim();
        ctxData['patientId'] = patientId;
        ctxData['firstname'] = patientName?.split(' ')[0];
        ctxData['lastname'] = patientName?.split(' ')[1];
        let dobSpan = document.querySelector('.form-group span[data-bind="text:patient().str_dob()"]');
        let dobText = dobSpan?.textContent?.trim();
        let dobMatch = RegExp(/\d{4}-\d{2}-\d{2}/).exec(dobText);
        if (dobMatch) {
            let dob = dobMatch[0];
            ctxData['DOB']=dob
        }
        ctxData['userDetails'] = {
          ...ctxData?.userDetails,
          username: fullName,
        };   
      if (ctxData['sessionId'] && ctxData['sessionId'].length > 0) {
      const globalWrapper = document?.querySelector('#mainBox');
      if (globalWrapper) {
        ctxData.userDetails.app = 'quickview';
        ctxData.userDetails.username = document
          .querySelector('#username #userdropdown .menuLabel')
          .textContent.trim();
        ctxData.tenantId = 'b070d4f0-1d92-446a-b3a1-875a317a3ca6';
      }

      if (ctxData?.userDetails?.providerId?.length > 0) {
        ctxData.userDetails = {
          providerId: ctxData?.userDetails?.providerId,
          app: 'quickview',
        };
      }

  
      if (!ctxData?.userDetails?.username) {
        const providerUserName = document
          .querySelector('#pc_facility option[selected="selected"]')
          .textContent.trim();
        ctxData.userDetails = {
          ...ctxData.userDetails,
          username: providerUserName,
        };
      }
  
      const patientId = document
        .querySelector('#attendantData span[data-bind="text: pubpid"]')
        .textContent.trim();
      ctxData['patientId'] = patientId;
  
      const chartIdElement = patientId;
      const chartId = chartIdElement ? chartIdElement.textContent.trim() : undefined;
      ctxData['chartId'] = chartId;
  
      const patientEncounterCode = document.querySelector('span[data-bind="text:selectedEncounter().id()"]').textContent.trim();
      ctxData['encounterId'] = patientEncounterCode;
    }
  
    return { ctxData, sessionTimeOut };
  };
  

  domLoaded = async () => {
    return new Promise((resolvePromise, rejectPromise) => {
      const globalWrapper = document?.querySelector('#mainBox');
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
