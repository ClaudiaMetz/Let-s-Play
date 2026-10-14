/* Compatibilidad para Safari/iOS y WebView Android antiguos. */
  (function(){
    if(window.CanvasRenderingContext2D&&!CanvasRenderingContext2D.prototype.roundRect){
      CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
        var radius=Array.isArray(r)?r[0]:(r||0);
        radius=Math.max(0,Math.min(radius,Math.abs(w)/2,Math.abs(h)/2));
        this.moveTo(x+radius,y);this.lineTo(x+w-radius,y);this.quadraticCurveTo(x+w,y,x+w,y+radius);
        this.lineTo(x+w,y+h-radius);this.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
        this.lineTo(x+radius,y+h);this.quadraticCurveTo(x,y+h,x,y+h-radius);
        this.lineTo(x,y+radius);this.quadraticCurveTo(x,y,x+radius,y);this.closePath();return this;
      };
    }
    var dialogs=document.getElementsByTagName('dialog');
    for(var d=0;d<dialogs.length;d++){
      if(!dialogs[d].showModal){dialogs[d].showModal=function(){this.setAttribute('open','');this.style.display='block';};if(!dialogs[d].close)dialogs[d].close=function(){this.removeAttribute('open');this.style.display='none';};if(!dialogs[d].hasAttribute('open'))dialogs[d].style.display='none';}
    }
    if(!window.PointerEvent){
      if(window.Element&&!Element.prototype.setPointerCapture)Element.prototype.setPointerCapture=function(){};
      if(window.Element&&!Element.prototype.releasePointerCapture)Element.prototype.releasePointerCapture=function(){};
      function relay(touchEvent,pointerType){
        var touch=(touchEvent.changedTouches&&touchEvent.changedTouches[0])||(touchEvent.touches&&touchEvent.touches[0]);
        if(!touch)return;
        var event=document.createEvent('Event');event.initEvent(pointerType,true,true);
        var values={clientX:touch.clientX,clientY:touch.clientY,pageX:touch.pageX,pageY:touch.pageY,pointerId:touch.identifier+1,pointerType:'touch',isPrimary:true};
        Object.keys(values).forEach(function(key){try{Object.defineProperty(event,key,{value:values[key]});}catch(ignore){}});
        touchEvent.target.dispatchEvent(event);
        if(event.defaultPrevented&&touchEvent.cancelable)touchEvent.preventDefault();
      }
      document.addEventListener('touchstart',function(e){relay(e,'pointerdown');},{passive:false});
      document.addEventListener('touchmove',function(e){relay(e,'pointermove');},{passive:false});
      document.addEventListener('touchend',function(e){relay(e,'pointerup');},{passive:false});
      document.addEventListener('touchcancel',function(e){relay(e,'pointercancel');},{passive:false});
    }
  })();
