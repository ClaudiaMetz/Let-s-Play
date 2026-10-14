(()=>{if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;navigator.serviceWorker.register('./sw.js').then(registration=>registration.update()).catch(()=>{})})();
