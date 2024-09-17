export class AthenaNetEhr {
  constructor(onUnloadCb) {
    this.onUnloadCb = onUnloadCb;
    this.registeredUnloadEvent = false;
  }

  discoverContext = async () => {
    const ctxData = { userDetails: {} };
    const sessionCookies = await chrome.runtime.sendMessage({
      action: 'getSessionCookies',
      url: window.location.origin,
      ehr: 'ATHENA_EHR',
    });

    ctxData['sessionId'] = sessionCookies?.sessionId || undefined;
    const sessionTimeOut = sessionCookies?.timeOut || -1;
    if (ctxData.sessionId?.length === 0 || sessionTimeOut <= 0) {
      return { ctxData, sessionTimeOut };
    }

    const mainIframe = document?.getElementById('GlobalWrapper');
    if (mainIframe) {
      const iframeContent = mainIframe?.contentDocument;
      const frameset = iframeContent?.getElementById('frWrapper');
      const allFrames = frameset?.querySelectorAll('frame');
      if (allFrames && allFrames.length > 2) {
        const elementContent = allFrames[2]?.contentDocument;
        if (elementContent) {
          const frameContentWrapper = elementContent?.getElementById(
            'frameContentWrapper'
          );

          const frMainWrapper =
            frameContentWrapper?.querySelector('#frMainWrapper');
          if (frMainWrapper) {
            const frMainIframe = frMainWrapper?.querySelector('#frMain');
            const frMainIframeContent = frMainIframe?.contentDocument;
            const pageLayoutDiv =
              frMainIframeContent?.getElementById('page-layout');
            const pageBodyDiv = pageLayoutDiv?.querySelector('#page-body');
            const briefingElement = pageBodyDiv?.querySelector(
              '.briefing.autostart.sticky-container'
            );
            const patientBannerDiv = briefingElement?.querySelector(
              '.grid-row.content.has-full-width-patient-banner'
            );
            const cardStackDiv = patientBannerDiv?.querySelector('.card-stack');
            const specificCardDiv = cardStackDiv?.querySelector(
              '.card.c_card.c__card--title.overview-section.last-visit.metric-location.autostart.display-none.sticky-section'
            );
            const cardContent =
              specificCardDiv?.querySelector('.card-content ');
            const anchorTag = cardContent?.querySelector('.appointment-header');
            if (anchorTag) {
              const href = anchorTag.getAttribute('href');
              const idMatch = href.match(/\/(\d+)\/summary/);
              if (idMatch && idMatch[1]) {
                const id = idMatch[1];
                ctxData['encounterId'] = id;
              }
            }
          }
        }
      }
      const innerFrame = frameset?.getElementsByTagName('frame')[2];
      const mainFrame =
        innerFrame?.contentDocument?.getElementById('frMain')?.contentWindow;

      const userData =
        mainFrame?.document?.getElementById('metrics-data')?.textContent;
      if (userData) ctxData['userDetails'] = JSON.parse(userData);

      const departmentIdElement = mainFrame?.document?.getElementById(
        'meta-session-department-id'
      );
      const departmentId = departmentIdElement?.getAttribute('content');
      if (departmentId) ctxData['tenantId'] = departmentId;

      const patientName = mainFrame?.document
        ?.querySelector('.patient-name div span')
        ?.innerText?.replace(/(^\s+|\s+$)/gm, '');
      if (patientName) ctxData['patientName'] = patientName;

      let shadowContainer = mainFrame?.document?.querySelector(
        '#nimbus-banner-shadow-dom-container'
      );
      let shadowRoot = shadowContainer?.shadowRoot;

      if (!shadowContainer) {
        shadowContainer = mainFrame?.document?.querySelector(
          '#nimbus-banner-container'
        );
        let banerContainer = shadowContainer?.querySelector(
          '#skeleton-fallback-banner-container'
        );

        shadowRoot = banerContainer?.shadowRoot;
        let demographics = shadowRoot?.querySelector(
          '#skeleton-patient-banner .demographics'
        );

        let spans = demographics?.getElementsByTagName('span');
        let firstNameElement = shadowRoot?.querySelector(
          '#skeleton-patient-banner .first-name'
        );
        if (firstNameElement) {
          let firstName = Array.from(firstNameElement.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent.trim())
            .join('');
          let lastNameElement = shadowRoot?.querySelector(
            '#skeleton-patient-banner .last-name'
          )?.innerText;
          ctxData['firstname'] = firstName;
          ctxData['lastname'] = lastNameElement;
        }

        for (let i = 0; i < spans?.length; i++) {
          if (spans[i].textContent.trim().startsWith('#')) {
            let dob = spans[1]?.innerText;
            ctxData['DOB'] = dob;
            let number = spans[i].textContent.trim().substring(1);
            ctxData['patientId'] = number;

            break;
          }
        }
      } else {
        const pId = shadowRoot?.querySelector(
          '.pb_c_patient-banner-component__details .pb_c_patient-banner-component__detail:nth-child(3)'
        )?.textContent;

        ctxData['patientId'] = pId ? pId?.substring(1) : '';
      }

      const contextData = JSON.parse(
        mainFrame?.document?.getElementById('default-data-context')?.content ||
          '[]'
      );
      contextData.forEach((e) => {
        if (e['chart_id']) {
          ctxData['chartId'] = e['chart_id'];
        } else if (e['encounter_id']) {
          // ctxData['encounterId'] = e['encounter_id'];
        }
      });

      let providerValue = 'p-agerardiemailm';
      ctxData['userDetails']['providerId'] = providerValue;
    }

    if (ctxData?.userDetails?.providerId?.length > 0) {
      ctxData['userDetails'] = {
        providerId: ctxData?.userDetails?.providerId,
        context_id: window?.location?.pathname?.split('/')[1],
        app: 'quickview',
      };
    }

    if (!ctxData?.userDetails?.username) {
      const providerUserName = document
        ?.getElementById('GlobalNav')
        ?.contentDocument?.getElementById('usermenucomponent')?.innerText;
      ctxData['userDetails'] = {
        ...ctxData?.userDetails,
        username: providerUserName,
      };
    }

    if (!ctxData.tenantId) {
      const departmentId = document
        ?.getElementById('Status')
        ?.contentDocument?.getElementById('DEPARTMENTID')?.value;
      ctxData['tenantId'] = departmentId;
    }

    return { ctxData, sessionTimeOut };
  };

  domLoaded = async () => {
    return new Promise((resolvePromise, rejectPromise) => {
      const globalWrapper = document?.getElementById('GlobalWrapper');
      if (globalWrapper) {
        const iframeContent = globalWrapper?.contentDocument;
        const frameset = iframeContent?.getElementById('frWrapper');
        const innerFrame = frameset?.getElementsByTagName('frame')[2];
        const mainFrame =
          innerFrame?.contentDocument?.getElementById('frMain')?.contentWindow;

        if (!this.registeredUnloadEvent) {
          mainFrame?.addEventListener('beforeunload', () => {
            setTimeout(this.onUnloadCb, 100);
          });
          this.registeredUnloadEvent = true;
        }
        if (mainFrame && mainFrame?.document?.readyState === 'complete') {
          resolvePromise(true);
        } else {
          resolvePromise(false);
        }
      } else {
        resolvePromise(false);
      }
    });
  };
}
