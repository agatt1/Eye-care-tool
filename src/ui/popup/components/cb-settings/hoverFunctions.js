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
export function hoverFun(){
    
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
                        else if((hue >= 60) && (hue < 120)){
                            color = "yellow";
                        }
                        else if((hue >= 120) && (hue < 180)){
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

                        document.onmousemove = function(e){
                            try {
                                var mousecoords = getMousePos(e);
                                var image_data = prepareCanvas();
                                var rgbArray = getPixelXY(image_data,mousecoords.x,mousecoords.y);
                                var hsvArray = rgbtoHSV(rgbArray);
                                var final_color = HSVtoColor(hsvArray);
                                console.log(hsvArray[0], hsvArray[1], hsvArray[2]);
                                console.log(final_color);
                                //console.log(hsvArray[0]);    
                            } catch (error) {
                                console.log("DOMException - source width is 0");
                            }
                            
                            //console.log(mousecoords.x, mousecoords.y);
                            //console.log(final_img.width, final_img.height);
                    }
        
                   return {success: true};
                } + ')('+ JSON.stringify(dataToWebPage) + ');'
            }, function(results){
        
            });
            
        });
    }

    getColor();
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
export function hoverFunOld(){

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