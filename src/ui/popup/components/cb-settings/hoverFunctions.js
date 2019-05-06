//this version of hoverFunction uses chrome's capturevisibleTab method to obtain an image
/*
Things Checked:
    1. Image dataUrl is consistent with dataUrl obtained before code injection
    2. Image has consistent width and length parameters
    3. onmousemove seems to work correctly
    4. Image width and length correspond to cursor x,y maximums (image captures entire browser window)
    5. RGB values are correct, works with entire browser window
    6. HSV values are correct, works correctly with mouse x,y position
    7. Some exceptions are being thrown. These exceptions are related the the getImageData function
    from the prepareCanvas function. I believe this issue is due to how I'm drawing the image to the canvas.
    I looked into this issue, one mentioned fix was using the image's natural height and width instead of the
    regular height and width. I did this, but the exception was still being thrown. I have surrounded the 
    onmousemove statements in a try catch block to deal with these exceptions.
*/
export function hoverFunVer2(){
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var currentTab = tabs[0];

        var scriptInputs = [currentTab.id, currentTab.windowId];

        chrome.tabs.executeScript(currentTab.id, {
            code: '(' + 
                function(tabId, windowId) {
                    var dataUrl = null;

                    var latestRequestId = -1;
                    var latestFinishedRequestId = -1;
                    function captureVisibleTab(callback) {
                        var thisRequestId = ++latestRequestId;

                        chrome.runtime.sendMessage({
                            message: "Capture visible tab", 
                            tabId: tabId, 
                            windowId: windowId
                        }, function(response) {
                            if (response.message == "Captured visible tab") {
                                if (thisRequestId > latestFinishedRequestId) { 
                                    latestFinishedRequestId = thisRequestId; // TODO: fix race condition with if statement, and dataUrl update
                                    dataUrl = response.dataUrl; 
                                }
                                callback();
                            }
                        });
                    }
                    captureVisibleTab(function() { });

                    //all javascript here is executed by browser, not extension
                    function round(value, decimals){
                        return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
                    }
                    //gets x,y position of the cursor
                    function getMousePos(e){
                        return {x:e.clientX,y:e.clientY};
                    }
                    //gets the rgb values of a pixel
                    function getPixel(imgData, index) {
                        var i = index*4, d = imgData.data;
                        return [d[i],d[i+1],d[i+2],d[i+3]] // [R,G,B,A]
                    }
                    //input: image data, x,y location of the cursor
                    //output: rgb values of the pixel at cursor location  
                    function getPixelXY(imgData, x, y) {
                        return getPixel(imgData, y*imgData.width+x);
                    }
                    //prepares the canvas, returns image data of the entire image (browser window)
                    function prepareCanvas(){
                        var final_img = new Image();
                        final_img.src = dataUrl;

                        if (final_img.width > 0 && final_img.height > 0) {
                            var canvas = document.createElement('canvas');
                            canvas.width = final_img.width;
                            canvas.height = final_img.height;
                            var context = canvas.getContext("2d");
                            context.drawImage(final_img,0,0,canvas.width,canvas.height);
                            var idt = context.getImageData(0, 0, canvas.width, canvas.height);
                            return {image_data: idt, width: canvas.width, height: canvas.height};
                        } else {
                            return null;
                        }
                    }
                    function getViewportDimensions() {
                        return {width: window.innerWidth, height: window.innerHeight};
                    }
                    
                    function rgbToColor(rgbArray){
                        var colorArray = [];
                        var rgbArrayMinIndex = 0;
                        var tempMinDistance = 10000000;
                        var rgb_final_color = "unknown";
                        var r1 = rgbArray[0];
                        var b1 = rgbArray[1];
                        var g1 = rgbArray[2];

                        //RGB VALUE                         X11 COLOR NAME        INTERPRETED COLOR (ACTUAL COLOR USER SEES)

                        //Pink Colors
                        colorArray.push([255,192,203]);     //pink                  Pink
                        colorArray.push([255,182, 193]);    //light pink            Light Pink
                        colorArray.push([255,105,180]);     //hot pink              Pink
                        colorArray.push([255,20,147]);      //deep pink             Dark Pink
                        colorArray.push([219,112,147]);     //pale violet red       Dark Pink
                        colorArray.push([199,21,133]);      //medium violet red     Dark Pink

                        //Red Colors
                        colorArray.push([255,0,0]);         //red                   Red
                        colorArray.push([139,0,0]);         //dark red              Dark Red
                        colorArray.push([255,160,122]);     //light salmon          Light Red
                        colorArray.push([255,128,114]);     //salmon                Light Red
                        colorArray.push([233,150,122]);     //dark salmon           Light Red
                        colorArray.push([220,20,60]);       //crimson               Light Red
                        colorArray.push([178,34,34]);       //firebrick             Red

                        //Orange Colors
                        colorArray.push([255,165,0]);       //orange                Orange
                        colorArray.push([255,127,80]);      //coral                 Light Orange
                        colorArray.push([255,140,0]);       //dark orange           Dark Orange
                        colorArray.push([255,69,0]);        //orange red            Orange
                        colorArray.push([255,99,71]);       //tomato                Light Orange

                        //Yellow Colors
                        colorArray.push([255,255,0]);       //yellow                Yellow
                        colorArray.push([255,255,224]);     //light yellow          Light Yellow
                        colorArray.push([255,215,0]);       //gold                  Yellow
                        colorArray.push([255,239,213]);     //papaya whip           Light Yellow (POTENTIAL PROBLEM)
                        colorArray.push([255,250,205]);     //lemon chiffron        Light Yellow
                        colorArray.push([240,230,140]);     //khaki                 Light Yellow
                        colorArray.push([238,232,170]);     //pale golden rod       Light Yellow

                        //Brown Colors
                        //colorArray.push([165,42,42]);     //brown POTENTIAL ISSUE -> Very similar to Red
                        colorArray.push([255,228,196]);     //bisque                Light Brown
                        colorArray.push([255,235,205]);     //blanched almond       Light Brown
                        colorArray.push([222,184,135]);     //burly wood            Light Brown
                        colorArray.push([128,0,0]);         //marooon               Dark Brown
                        colorArray.push([160,82,45]);       //sienna                Brown
                        colorArray.push([139,69,19]);       //saddle brown          Brown
                        colorArray.push([210,105,30]);      //chocolate             Brown
                        colorArray.push([205,133,63]);      //peru                  Brown
                        colorArray.push([245,222,173]);     //wheat                 Light Brown

                        //Green Colors
                        colorArray.push([0,255,0]);         //lime                  Green
                        colorArray.push([85,107,47]);       //dark olive green      Dark Green
                        colorArray.push([128,128,0]);       //olive                 Green
                        colorArray.push([107,142,35]);      //olive drab            Green
                        colorArray.push([154,205,50]);      //yellow green          Light Green
                        colorArray.push([50,205,50]);       //Lime Green            Green
                        colorArray.push([124,252,0]);       //lawn green            Light Green
                        colorArray.push([127,255,0]);       //chartreuse            Light Green
                        colorArray.push([173,255,47]);      //green yellow          Light Green
                        colorArray.push([0,255,127]);       //spring green          Light Green
                        colorArray.push([144,238,144]);     //light green           Light Green
                        colorArray.push([34,139,34]);       //forest green          Green
                        colorArray.push([0,128,0]);         //green                 Green
                        colorArray.push([0,100,0]);         //dark green            Dark Green
                        
                        //Cyan Colors
                        colorArray.push([0,255,255]);       //aqua                  Light Blue
                        colorArray.push([127,255,212]);     //aquamarine            Light Blue
                        colorArray.push([224,255,225]);     //light cyan            Light Blue
                        colorArray.push([64,224,208]);      //turquoise             Light Blue
                        colorArray.push([0,206,209]);       //dark turquoise        Light Blue
                        colorArray.push([95,158,160]);      //cadet blue            Light Blue                        

                        //Blue Colors
                        colorArray.push([0,0,255]);         //blue                  Blue
                        colorArray.push([173,216,230]);     //light blue            Light Blue
                        colorArray.push([176,196,222]);     //light steel blue      Light Blue
                        colorArray.push([135,206,235]);     //sky blue              Light Blue
                        colorArray.push([0,191,255]);       //deep sky blue         Light Blue
                        colorArray.push([30,144,255]);      //dodger blue           Blue
                        colorArray.push([100,149,237]);     //cornflower blue       Light Blue
                        colorArray.push([70,130,180]);      //steel blue            Light Blue
                        colorArray.push([65,105,225]);      //royal blue            Light Blue
                        colorArray.push([0,0,205]);         //medium blue           Blue
                        colorArray.push([0,0,139]);         //dark blue             Dark Blue
                        colorArray.push([25,25,112]);       //midnight blue         Dark Blue
                        
                        //Purple, Violet, Magenta Colors
                        colorArray.push([128,0,128]);       //purple                Purple
                        colorArray.push([138,43,226]);      //blue violet           Purple
                        colorArray.push([216,191,216]);     //thistle               Light Purple
                        colorArray.push([221,160,221]);     //plum                  Light Purple
                        colorArray.push([238,130,238]);     //violet                Light Purple
                        colorArray.push([218,112,214]);     //orchid                Light Purple
                        colorArray.push([255,0,255]);       //fuchsia               Light Purple
                        colorArray.push([186,85,211]);      //medium orchid         Light Purple
                        colorArray.push([147,112,219]);     //medium purple         Light Purple
                        colorArray.push([148,0,211]);       //dark violet           Purple
                        colorArray.push([153,50,204]);      //dark orchid           Purple
                        colorArray.push([139,0,139]);       //dark magenta          Purple
                        colorArray.push([75,0,130]);        //indigo                Dark Purple
                        
                        //White Colors
                        colorArray.push([255,255,255]);     //white                 White
                        colorArray.push([240,248,255]);     //alice blue            White
                        colorArray.push([240,255,255]);     //azure                 White
                        colorArray.push([245,245,220]);     //beige                 White
                        colorArray.push([255,255,240]);     //ivory                 White
                        colorArray.push([255,250,240]);     //floral white          White
                        
                        //Gray and Black Colors
                        colorArray.push([128,128,128]);     //gray                  Gray
                        colorArray.push([0,0,0]);           //black                 Black
                        colorArray.push([211,211,211]);     //light gray            Light Gray
                        colorArray.push([169,169,169]);     //dark gray             Gray
                        colorArray.push([192,192,192]);     //silver                Light Gray
                        colorArray.push([105,105,105]);     //dim gray              Dark Gray


                        for(i = 0; i < colorArray.length; i++){
                            
                            var rgbDistance = Math.abs(r1 - colorArray[i][0]) + 
                                            Math.abs(b1 - colorArray[i][1]) + 
                                            Math.abs(g1 - colorArray[i][2]);
                            if(rgbDistance < tempMinDistance){
                                rgbArrayMinIndex = i;
                                tempMinDistance = rgbDistance;
                            }
                            
                        }
                                
                                //NAMED COLOR                       //ACTUAL COLOR
                        switch (rgbArrayMinIndex) {
                            //Pink Colors
                            case 0:
                                rgb_final_color = "Pink";            //pink
                                break;
                            case 1:
                                rgb_final_color = "Light Pink";     //light pink
                                break;
                            case 2:
                                rgb_final_color = "Pink";           //hot pink
                                break;
                            case 3:
                                rgb_final_color = "Dark Pink";      //deep pink
                                break;
                            case 4:
                                rgb_final_color = "Dark Pink";      //pale violet red
                                break;
                            case 5:
                                rgb_final_color = "Dark Pink";      //medium violet red
                                break;
                            
                                //Red Colors
                            case 6:
                                rgb_final_color = "Red";            //red
                                break;
                            case 7:
                                rgb_final_color = "Dark Red";       //dark red
                                break;
                            case 8:
                                rgb_final_color = "Light Red";     //light salmon
                                break;
                            case 9:
                                rgb_final_color = "Light Red";      //salmon
                                break;
                            case 10:
                                rgb_final_color = "Light Red";      //dark salmon
                                break;
                            case 11:
                                rgb_final_color = "Light Red";      //crimson
                                break;
                            case 12:
                                rgb_final_color = "Red";            //firebrick
                                break;
                            
                            //Orange Colors
                            case 13:
                                rgb_final_color = "Orange";         //orange
                                break;
                            case 14:
                                rgb_final_color = "Light Orange";   //coral
                                break;
                            case 15:
                                rgb_final_color = "Orange";         //dark orange
                                break;
                            case 16:
                                rgb_final_color = "Orange";         //orange red
                                break;
                            case 17:
                                rgb_final_color = "Light Orange";   //tomato
                                break;

                            //Yellow Colors
                            case 18:
                                rgb_final_color = "Yellow"          //yellow
                                break;
                            case 19:
                                rgb_final_color = "Light Yellow"    //light yellow
                                break;
                            case 20:
                                rgb_final_color = "Yellow"          //gold
                                break;
                            case 21:
                                rgb_final_color = "Light Yellow"    //papaya whip
                                break;
                            case 22:
                                rgb_final_color = "Light Yellow"    //lemon chiffron
                                break;
                            case 23:
                                rgb_final_color = "Light Yellow"    //khaki
                                break;
                            case 24:
                                rgb_final_color = "Light Yellow"    //pale golden rod
                                break;

                            //Brown Colors
                            case 25:
                                rgb_final_color = "Light Brown"     //bisque
                                break;
                            case 26:
                                rgb_final_color = "Light Brown"     //blanched almond
                                break;
                            case 27:
                                rgb_final_color = "Light Brown"     //burly wood
                                break;
                            case 28:
                                rgb_final_color = "Dark Brown"      //maroon
                                break;
                            case 29:
                                rgb_final_color = "Brown"           //sienna
                                break;
                            case 30:
                                rgb_final_color = "Brown"           //saddle brown
                                break;
                            case 31:
                                rgb_final_color = "Brown"           //chocolate
                                break;
                            case 32:
                                rgb_final_color = "Brown"           //peru
                                break;
                            case 33:
                                rgb_final_color = "Light Brown"    //wheat
                                break;

                            //Green Colors
                            case 34:
                                rgb_final_color = "Green"           //lime
                                break;
                            case 35:
                                rgb_final_color = "Dark Green"      //dark olive green
                                break;
                            case 36:
                                rgb_final_color = "Green"           //olive
                                break;
                            case 37:
                                rgb_final_color = "Green"           //olive drab
                                break;
                            case 38:
                                rgb_final_color = "Light Green"     //yellow green
                                break;
                            case 39:
                                rgb_final_color = "Green"           //lime green
                                break;
                            case 40:
                                rgb_final_color = "Light Green"     //lawn green
                                break;
                            case 41:
                                rgb_final_color = "Light Green"     //chartreuse
                                break;
                            case 42:
                                rgb_final_color = "Light Green"     //green yellow
                                break;
                            case 43:
                                rgb_final_color = "Light Green"     //spring green
                                break;
                            case 44:
                                rgb_final_color = "Light Green"     //light green
                                break;
                            case 45:
                                rgb_final_color = "Green"           //forest green
                                break;
                            case 46:
                                rgb_final_color = "Green"           //green
                                break;
                            case 47:
                                rgb_final_color = "Dark Green"      //dark green
                                break;

                            //Cyan Colors
                            case 48:
                                rgb_final_color = "Light Blue"      //aqua
                                break;
                            case 49:
                                rgb_final_color = "Light Blue"      //aquamarine
                                break;
                            case 50:
                                rgb_final_color = "Light Blue"      //light cyan
                                break;
                            case 51:
                                rgb_final_color = "Light Blue"      //turquoise
                                break;
                            case 52:
                                rgb_final_color = "Light Blue"      //dark turquoise
                                break;
                            case 53:
                                rgb_final_color = "Light Blue"      //cadet blue
                                break;

                            //Blue Colors
                            case 54:
                                rgb_final_color = "Blue"            //blue
                                break;
                            case 55:
                                rgb_final_color = "Light Blue"      //light blue
                                break;
                            case 56:
                                rgb_final_color = "Light Blue"      //light steel blue
                                break;
                            case 57:
                                rgb_final_color = "Light Blue"      //sky blue
                                break;
                            case 58:
                                rgb_final_color = "Light Blue"      //deep sky blue
                                break;
                            case 59:
                                rgb_final_color = "Light Blue"      //dodger blue
                                break;
                            case 60:
                                rgb_final_color = "Light Blue"      //cornflower blue
                                break;
                            case 61:
                                rgb_final_color = "Light Blue"      //steel blue
                                break;
                            case 62:
                                rgb_final_color = "Light Blue"      //royal blue
                                break;
                            case 63:
                                rgb_final_color = "Blue"            //medium blue
                                break;
                            case 64:
                                rgb_final_color = "Dark Blue"       //dark blue
                                break;
                            case 65:
                                rgb_final_color = "Dark Blue"       //midnight blue
                                break;

                            //Purple Colors
                            case 66:
                                rgb_final_color = "Purple"          //purple
                                break;
                            case 67:
                                rgb_final_color = "Purple"          //blue violet
                                break;
                            case 68:
                                rgb_final_color = "Light Purple"    //thistle
                                break;
                            case 69:
                                rgb_final_color = "Light Purple"    //plum
                                break;
                            case 70:
                                rgb_final_color = "Light Purple"    //violet
                                break;
                            case 71:
                                rgb_final_color = "Light Purple"    //orchid
                                break;
                            case 72:
                                rgb_final_color = "Light Purple"    //fuchsia
                                break;
                            case 73:
                                rgb_final_color = "Light Purple"    //medium orchid
                                break;
                            case 74:
                                rgb_final_color = "Light Purple"    //medium purple
                                break;
                            case 75:
                                rgb_final_color = "Purple"          //dark violet
                                break;
                            case 76:
                                rgb_final_color = "Purple"          //dark orchid
                                break;
                            case 77:
                                rgb_final_color = "Purple"          //dark magenta
                                break;
                            case 78:
                                rgb_final_color = "Dark Purple"     //indigo
                                break;

                            //White Colors
                            case 79:
                                rgb_final_color = "White"           //white
                                break;
                            case 80:
                                rgb_final_color = "White"           //alice blue
                                break;
                            case 81:
                                rgb_final_color = "White"           //azure
                                break;
                            case 82:
                                rgb_final_color = "White"           //beige
                                break;
                            case 83:
                                rgb_final_color = "White"           //ivory
                                break;
                            case 84:
                                rgb_final_color = "White"           //floral white
                                break;

                            //Gray and Black colors
                            case 85:
                                rgb_final_color = "Gray"            //gray
                                break;
                            case 86:
                                rgb_final_color = "Black"           //black
                                break;
                            case 87:
                                rgb_final_color = "Light Gray"      //light gray
                                break;
                            case 88:
                                rgb_final_color = "Gray"            //dark gray
                                break;
                            case 89:
                                rgb_final_color = "Light Gray"      //silver
                                break;
                            case 90:
                                rgb_final_color = "Dark Gray"       //dim gray
                                break;
                            default:
                                break;
                        }

                        return rgb_final_color;
                    }

                    var indicatorDiv = document.createElement('div');
                    indicatorDiv.style = "position: fixed; left: 200px; top: 30px; z-index: 9999; background-color: white; border: 2px solid black; display: flex; flex-direction: row; align-items: center";

                    var indicatorText = document.createElement('div');
                    indicatorText.textContent = "Color";
                    indicatorText.style = "font-size: 30px; color: black;";
                    indicatorDiv.appendChild(indicatorText);

                    var indicatorLoadingImage = document.createElement("img");
                    indicatorLoadingImage.src = "https://i.imgur.com/kfk1nBZ.gif";
                    indicatorLoadingImage.alt = "(loading)";
                    indicatorLoadingImage.style = "display: none";
                    indicatorLoadingImage.id = "hoverColorLoading"
                    indicatorDiv.appendChild(indicatorLoadingImage);

                    var root = document.documentElement;
                    root.prepend(indicatorDiv);

                    var mouseCoords = null;

                    function updateDisplayedColor() {
                        if (dataUrl != null && mouseCoords != null) {
                            var canvas = prepareCanvas();
                            if (canvas != null) {
                                var viewport = getViewportDimensions();
                                var adjustedMouseCoords = {
                                    x: Math.round(mouseCoords.x * (canvas.width / viewport.width)),
                                    y: Math.round(mouseCoords.y * (canvas.height / viewport.height))
                                };
                                var rgbArray = getPixelXY(canvas.image_data, adjustedMouseCoords.x, adjustedMouseCoords.y);
                                var final_color = rgbToColor(rgbArray);
    
                                indicatorText.textContent = final_color;
                            }
                        }
                    }

                    var mouseMoveFun = function(e){
                        mouseCoords = getMousePos(e);
                        updateDisplayedColor();
                    }
                    document.addEventListener("mousemove", mouseMoveFun);

                    var numberOfActiveScrollEvents = 0; 
                    window.addEventListener("scroll", function(e) { 
                        indicatorLoadingImage.style = "display: block";
                        numberOfActiveScrollEvents++;
                        
                        captureVisibleTab(function() { 
                            updateDisplayedColor();
                            numberOfActiveScrollEvents--; // TODO: fix race condition with if statement
                            if (numberOfActiveScrollEvents == 0) { 
                                indicatorLoadingImage.style = "display: none";
                            }
                        });
                    });

                } + ')(' + scriptInputs.join(", ") + ');'
        }, function() { });
    });
}