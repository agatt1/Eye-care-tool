/*this version of hoverFunction captures an image every 0.5 seconds
Things checked:
*/
export function hoverFunVer3(){
    //this function injects the html on the webpage (only runs once)
    function initialInject(){
        chrome.tabs.executeScript({
            code: '(' + function(){
                var ColorHoverThing = document.createElement('div');
                ColorHoverThing.textContent = "Color";
                ColorHoverThing.id = "hoverColorDiv"
                ColorHoverThing.setAttribute("style", "position: absolute; left: 500px; top: 30px; font-size: 50px; color: red");
                var root = document.documentElement;
                root.prepend(ColorHoverThing);
                console.log("html element created");
               return {success: true};
            } + ')(' + ');'
        }, function(results){
    
        });
    }
    //this function runs every 0.5 seconds, it first captures a tab, then it analyzes color
    function getColorLoop(){
        function captureTab(){
            //capture the visible tab, then send a message with the dataUrl (url to make image)
            chrome.tabs.captureVisibleTab(null, {format: "png"}, function(dataUrl){
                chrome.runtime.sendMessage({'dataUrlMessage': dataUrl});
                console.log("dataUrl sent");
            })
        }
        //listen for message
        //console.log("exit visibleTab");
        function createImage(){
            chrome.runtime.onMessage.addListener(function(myMessage, sender, sendResponse){
                console.log("entered listener");
                if('dataUrlMessage' in myMessage){
                    console.log("message received");
                    //if message is correctly sent, create new image
                    var dataUrl = dataUrlMessage;
                    var new_img = new Image();
                    new_img.src = dataUrl;
                    console.log("Image Created");
                }
                else
                    console.log("message was not received");
            })
            console.log("end of createImage function");
        }
        createImage();
        captureTab();
        //createImage();    
        console.log("end of function");

    } 

    initialInject();
    setInterval(getColorLoop,1000);

    /*ignore this crap
    var img_dataUrl = "incorrect message";
        chrome.tabs.captureVisibleTab(null, {format: "png"}, function(dataUrl){
            img_dataUrl = dataUrl;
            return img_dataUrl;
            //console.log(img_dataUrl);
        })
        if(img_dataUrl != "incorrect message")
            console.log("actually worked");
        else
            console.log("failed");
    */
}


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
    
    function getColor(){
        chrome.tabs.captureVisibleTab(null, {format: "png"}, function(dataUrl){
            var dataToWebPage = dataUrl;
            chrome.tabs.executeScript({
                code: '(' + function(params){
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
                        final_img.src = params;
                        var canvas = document.createElement('canvas');
                        canvas.width = final_img.width;
                        canvas.height = final_img.height;
                        //canvas.width = final_img.naturalWidth;
                        //canvas.height = final_img.naturalHeight;
                        var context = canvas.getContext("2d");
                        context.drawImage(final_img,0,0,canvas.width,canvas.height);
                        var idt = context.getImageData(0, 0, canvas.width, canvas.height);
                        return idt;
                    }
                    //convert rgb values to hsv values
                    function rgbtoHSV(rgbArray){
                        //rgb values need to be in float (0 - 1) instead of (0 - 255)
                        var red = rgbArray[0] / 255.0;
                        var green = rgbArray[1] / 255.0;
                        var blue = rgbArray[2] / 255.0;
                        
                        var res = [];
                        var k = 0.0;
                        var temp;
                        
                        if(green < blue){
                            temp = green;
                            green = blue;
                            blue = temp;
                            k = -1.0;
                        }
                        if(red < green){
                            temp = red;
                            red = green;
                            green = temp;
                            k = -2.0 / 6.0 - k;
                        }
                        var chroma = red;
                        if(green < blue){
                            chroma -= green;
                        }
                        else{
                            chroma -= blue;
                        }
                        res[0] = round((Math.abs(k + (green - blue) / (6.0 * chroma + 1e-20)) * 360), 0);
                        res[1] = round(chroma / (red + 1e-20), 2);
                        res[2] = round(red, 2);
                        return res; 
                    }
                    function HSVtoColor(hsvArray){
                        hue = hsvArray[0];
                        sat = hsvArray[1];
                        val = hsvArray[2];
                        
                        //Begin Error checking
                        if(hue < 0 || hue > 360){
                            console.log("Hue value: " + hue + " Hue is not between 0 and 360");
                        }
                        //Begin HSV testing
                        //TODO: Add black, white, gray, orange
                        var color;
                        if(val < 0.2){
                            color = "black";
                        }
                        else if((sat < 0.2) && (val < 0.85)){
                            color = "grey";
                        }
                        else if((sat < 0.15) && (val > 0.85)){
                            color = "white";
                        }
                        else if((hue >= 0) && (hue < 30)){
                            color = "red";
                        }
                        else if((hue >= 30) && (hue < 60)){
                            color = "orange";
                        }
                        else if((hue >= 60) && (hue < 110)){
                            color = "yellow";
                        }
                        else if((hue >= 110) && (hue < 180)){
                            color = "green";
                        }
                        else if((hue >= 180) && (hue < 240)){
                            color = "cyan";
                        }
                        else if((hue >= 240) && (hue < 300)){
                            color = "blue";
                        }
                        else if((hue >= 300) && (hue < 360)){
                            color = "magenta";
                        }
                        else{
                            color = "unknown?"
                        }
                        return color;
                    }

                    function rgbToColor(rgbArray){
                        var colorArray = [];
                        var rgbArrayMinIndex = 0;
                        var tempMinDistance = 10000000;
                        var rgb_final_color = "unknown";
                        var r1 = rgbArray[0];
                        var b1 = rgbArray[1];
                        var g1 = rgbArray[2];
                        var red = [255, 0, 255];
                        var green = [0, 255, 0];
                        var blue = [0, 0, 255];
                        var pink = [255, 192, 203];
                        var light_green = [144, 238, 144];
                        var orange = [255, 165, 0];
                        var yellow = [255, 255, 0];
                        var brown = [165, 42, 42];
                        var light_blue = [173, 216, 230];
                        var purple = [128, 0, 128];
                        var white = [255, 255, 255];
                        var gray = [128, 128, 128];
                        var black = [0, 0, 0];
                        colorArray.push(red);
                        colorArray.push(green);
                        colorArray.push(blue);
                        colorArray.push(pink);
                        colorArray.push(light_green);
                        colorArray.push(orange);
                        colorArray.push(yellow);
                        colorArray.push(brown);
                        colorArray.push(light_blue);
                        colorArray.push(purple);
                        colorArray.push(white);
                        colorArray.push(gray);
                        colorArray.push(black);
                        //console.log(colorArray[0][1]);

                        for(i = 0; i < colorArray.length; i++){
                            
                            var rgbDistance = Math.abs(r1 - colorArray[i][0]) + 
                                              Math.abs(b1 - colorArray[i][1]) + 
                                              Math.abs(g1 - colorArray[i][2]);
                            if(rgbDistance < tempMinDistance){
                                rgbArrayMinIndex = i;
                                tempMinDistance = rgbDistance;
                            }
                             
                        }

                        switch (rgbArrayMinIndex) {
                            case 0:
                                rgb_final_color = "red";
                                break;
                            case 1:
                                rgb_final_color = "green";
                                break;
                            case 2:
                                rgb_final_color = "blue";
                                break;
                            case 3:
                                rgb_final_color = "pink";
                                break;
                            case 4:
                                rgb_final_color = "light green";
                                break;
                            case 5:
                                rgb_final_color = "orange";
                                break;
                            case 6:
                                rgb_final_color = "yellow";
                                break;
                            case 7:
                                rgb_final_color = "brown";
                                break;
                            case 8:
                                rgb_final_color = "light blue";
                                break;
                            case 9:
                                rgb_final_color = "purple";
                                break;
                            case 10:
                                rgb_final_color = "white";
                                break;
                            case 11:
                                rgb_final_color = "gray";
                                break;
                            case 12:
                                rgb_final_color = "black";
                                break;
                        
                            default:
                                break;
                        }

                        return rgb_final_color;
                    }

                    var ColorHoverThing = document.createElement('div');
                    ColorHoverThing.textContent = "Color";
                    ColorHoverThing.id = "hoverColorDiv"
                    ColorHoverThing.setAttribute("style", "position: absolute; left: 500px; top: 30px; font-size: 50px; color: red");
                    var root = document.documentElement;
                    root.prepend(ColorHoverThing);
                    
                    

                        var mouseMoveFun = function(e){
                            try {
                                var mousecoords = getMousePos(e);
                                var image_data = prepareCanvas();
                                var rgbArray = getPixelXY(image_data,mousecoords.x,mousecoords.y);
                                var hsvArray = rgbtoHSV(rgbArray);
                                var final_color = HSVtoColor(hsvArray);
                                //var final_color = rgbToColor(rgbArray);
                                //console.log(rgbArray);
                                console.log(hsvArray[0], hsvArray[1], hsvArray[2]);
                                //console.log(final_color);
                                //html stuff
                                ColorHoverThing.textContent = final_color;
                                //console.log(hsvArray[0]);    
                            } catch (error) {
                                console.log("DOMException - source width is 0");
                            }
                            
                            //console.log(mousecoords.x, mousecoords.y);
                            //console.log(final_img.width, final_img.height);
                    }
                    document.addEventListener("mousemove", mouseMoveFun);

                    
                    var removeFunction = function(e){
                        window.removeEventListener("scroll", removeFunction);
                        document.removeEventListener("mousemove", mouseMoveFun);
                        ColorHoverThing.remove();
                        
                        chrome.extension.sendMessage({'message': "User has scrolled"})
                        console.log("message sent");
                    }
                    window.addEventListener("scroll", removeFunction);

                   
        
                   return {success: true};
                } + ')('+ JSON.stringify(dataToWebPage) + ');'
            }, function(results){
                console.log("script callback");
            });
        });
        console.log("execute script done");
    }

    getColor();
    console.log("finished getColor");
    chrome.extension.onMessage.addListener(function(myMessage, sender, sendResponse){
        console.log(myMessage);
        if('message' in myMessage)
            if(myMessage.message == "User has scrolled"){
                getColor();
            }
    })

    
}

//TODO: Fix this function so you can actually disable the hoverFunction
export function enableHoverFun(){

    var enableHover = false;
    
    if(enableHover == false){
        enableHover = true;
        hoverFunOld();
        
    }
    if(enableHover == true){
        enableHover = false;
        chrome.tabs.executeScript({
            code: '(' + function(){
                //console.log(3);
                
               return {success: true};
            } + ')(' + ');'
        }, function(results){
    
        });
        
    }
}

/*
This is the original function used for the hover tool. 
It captured the image in a very roundabout way. It went through the html and saved the first image associated
with the image tag as the image to be used with the tool. 
RGB values and HSV values are correct with this function. 
Problems:
1. This function only works on one image
2. This function only works with the first image in the html
3. The x,y values I input into getting the pixel data are incorrect. They are not the x,y values of the image,
they are the x,y values of the window. This should be corrected with chrome's captureVisibleTab
*/
export function hoverFunVer1(){

    var a = "nice meme";

        var dataToWebPage = {text: 'test', foo: 1, bar: false};
        chrome.tabs.executeScript({
            code: '(' + function(params) {
                //This function will  work in webpage
                console.log(params); //logs in webpage console
                function getPixel(imgData, index) {
                    var i = index*4, d = imgData.data;
                    return [d[i],d[i+1],d[i+2],d[i+3]] // [R,G,B,A]
                  }
                  
                  function getPixelXY(imgData, x, y) {
                    return getPixel(imgData, y*imgData.width+x);
                  }
                var canvas = document.createElement('canvas');
                var img = document.getElementsByTagName("img")[0];
                canvas.width = img.width;
                canvas.height = img.height;
                var context = canvas.getContext("2d");
                context.drawImage(img,0,0,canvas.width,canvas.height);
                var idt = context.getImageData(0, 0, canvas.width, canvas.height);
                function getMousePos(e){
                    return {x:e.clientX,y:e.clientY};
                }

                function rgbToHex(r, g, b) {
                    if (r > 255 || g > 255 || b > 255)
                        throw "Invalid color component";
                    return ((r << 16) | (g << 8) | b).toString(16);
                }

                //convert rgb values to hsv values
                function rgbtoHSV(r, g, b){
                    //rgb values need to be in float (0 - 1) instead of (0 -255)
                    var red = r / 255.0;
                    var green = g / 255.0;
                    var blue = b / 255.0;
                    
                    var res = [];
                    var k = 0.0;
                    var temp;
                    
                    if(green < blue){
                        temp = green;
                        green = blue;
                        blue = temp;
                        k = -1.0;
                    }
                    if(red < green){
                        temp = red;
                        red = green;
                        green = temp;
                        k = -2.0 / 6.0 - k;
                    }
                    var chroma = red;
                    if(green < blue){
                        chroma -= green;
                    }
                    else{
                        chroma -= blue;
                    }
                    res[0] = (Math.abs(k + (green - blue) / (6.0 * chroma + 1e-20)) * 360.0);
                    res[1] = chroma / (red + 1e-20);
                    res[2] = red;
                    return res; 
                }

                document.onmousemove = function(e){
                    var mousecoords = getMousePos(e);
                    //console.log(mousecoords.x);
                    //console.log(mousecoords.y);
                    //console.log(getPixelXY(idt,mousecoords.x,mousecoords.y));
                    var rgbArray = getPixelXY(idt,mousecoords.x,mousecoords.y);
                    var hsvArray = rgbtoHSV(rgbArray[0], rgbArray[1], rgbArray[2]);
                    //console.log(rgbArray[0],rgbArray[1],rgbArray[2]);
                    console.log(hsvArray[0], hsvArray[1], hsvArray[2]);

                    //console.log(rgbToHex(rgbArray[0],rgbArray[1],rgbArray[2]));
                };
                return {success: true, response: "This is from webpage."};
            } + ')(' + JSON.stringify(dataToWebPage) + ');'
        }, function(results) {
            //This is the callback response from webpage
            console.log(results[0]); //logs in extension console 
        });

    console.log(a);
    //window.prompt("sometext","defaultText");    
}

//Reference Stuff

/*basic code injection
chrome.tabs.executeScript({
        code: '(' + function(){
            //console.log(3);

           return {success: true};
        } + ')(' + ');'
    }, function(results){

    });
*/