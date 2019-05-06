import {rgbtoHSV, rgbToColor, HSVtoColor} from '../src/ui/popup/components/cb-settings/hoverFunctionsTest';
/*
test('RGB to HSV', () => {
    expect(rgbtoHSV([255,0,0])).toEqual([0,1,1]);
    expect(rgbtoHSV([255,255,255])).toEqual([0,0,1]);
    expect(rgbtoHSV([0,0,0])).toEqual([0,0,0]);
    expect(rgbtoHSV([0,255,0])).toEqual([120,1,1]);
    expect(rgbtoHSV([127,127,255])).toEqual([240,1,1]);
    expect(rgbtoHSV([191,64,191])).toEqual([300,1,1]);

});
*/
test('RGB to final color: Pink Colors', () => {
    expect(rgbToColor([255, 192, 203])).toEqual("Pink");
    expect(rgbToColor([255, 182, 193])).toEqual("Light Pink");
    expect(rgbToColor([255, 105, 180])).toEqual("Pink");
    expect(rgbToColor([255, 20, 147])).toEqual("Dark Pink");
    expect(rgbToColor([219, 112, 147])).toEqual("Dark Pink");
    expect(rgbToColor([199, 21, 133])).toEqual("Dark Pink");
});
test('RGB to final color: Red Colors', () => {
    expect(rgbToColor([255, 0, 0])).toEqual("Red");
    expect(rgbToColor([139, 0, 0])).toEqual("Dark Red");
    expect(rgbToColor([255, 160, 122])).toEqual("Light Red");
    expect(rgbToColor([250, 128, 114])).toEqual("Light Red");
    expect(rgbToColor([233, 150, 122])).toEqual("Light Red");
    expect(rgbToColor([240, 128, 128])).toEqual("Light Red");
    //expect(rgbToColor([205, 92, 92])).toEqual("Light Red"); TODO Add this color to the function
    expect(rgbToColor([220, 20, 60])).toEqual("Light Red");
    expect(rgbToColor([178, 34, 34])).toEqual("Red");
});
test('RGB to final color: Orange Colors', () => {
    expect(rgbToColor([255, 69, 0])).toEqual("Orange");
    expect(rgbToColor([255, 99, 71])).toEqual("Light Orange");
    expect(rgbToColor([255, 127, 80])).toEqual("Light Orange");
    expect(rgbToColor([255, 140, 0])).toEqual("Orange");
    expect(rgbToColor([255, 165, 0])).toEqual("Orange");
});
test('RGB to final color: Yellow Colors', () => {
    expect(rgbToColor([255, 255, 0])).toEqual("Yellow");
    expect(rgbToColor([255, 255, 224])).toEqual("Light Yellow");
    expect(rgbToColor([255, 250, 205])).toEqual("Light Yellow");
    expect(rgbToColor([255, 250, 210])).toEqual("Light Yellow");
    expect(rgbToColor([255, 239, 213])).toEqual("Light Yellow");
    expect(rgbToColor([238, 232, 170])).toEqual("Light Yellow");
    expect(rgbToColor([240, 230, 140])).toEqual("Light Yellow");
    expect(rgbToColor([255, 215, 0])).toEqual("Yellow");
});
test('RGB to final color: Brown Colors', () => {
    expect(rgbToColor([255, 235, 205])).toEqual("Light Brown");
    expect(rgbToColor([255, 228, 196])).toEqual("Light Brown");
    expect(rgbToColor([255, 222, 173])).toEqual("Light Brown");
    expect(rgbToColor([245, 222, 179])).toEqual("Light Brown");
    expect(rgbToColor([222, 184, 135])).toEqual("Light Brown");
    //expect(rgbToColor([244, 164, 96])).toEqual("Light Brown");  //TODO ADD this color, 'sandybrown'
    expect(rgbToColor([205, 133, 63])).toEqual("Brown");
    expect(rgbToColor([210, 105, 30])).toEqual("Brown");
    expect(rgbToColor([139, 69, 19])).toEqual("Brown");
    expect(rgbToColor([160, 82, 45])).toEqual("Brown");
    expect(rgbToColor([128, 0, 0])).toEqual("Dark Brown");
});
test('RGB to final color: Green Colors', () => {
    expect(rgbToColor([85, 107, 47])).toEqual("Dark Green");
    expect(rgbToColor([107, 142, 35])).toEqual("Green");
    expect(rgbToColor([154, 205, 50])).toEqual("Light Green");
    expect(rgbToColor([50, 205, 50])).toEqual("Green");
    expect(rgbToColor([0, 255, 0])).toEqual("Green");
    expect(rgbToColor([124, 252, 0])).toEqual("Light Green");
    expect(rgbToColor([127, 255, 0])).toEqual("Light Green");
    expect(rgbToColor([173, 255, 47])).toEqual("Light Green");
    expect(rgbToColor([0, 255, 127])).toEqual("Light Green");
    expect(rgbToColor([0, 250, 154])).toEqual("Light Green");
    expect(rgbToColor([144, 238, 144])).toEqual("Light Green");
    expect(rgbToColor([152, 251, 152])).toEqual("Light Green");
    expect(rgbToColor([34, 139, 34])).toEqual("Green");
    expect(rgbToColor([0, 128, 0])).toEqual("Green");
    expect(rgbToColor([0, 100, 0])).toEqual("Dark Green");
});
test('RGB to final color: Cyan Colors', () => {
    expect(rgbToColor([0, 255, 255])).toEqual("Light Blue");
    expect(rgbToColor([175, 238, 238])).toEqual("Light Blue");
    expect(rgbToColor([127, 255, 212])).toEqual("Light Blue");
    expect(rgbToColor([64, 224, 208])).toEqual("Light Blue");
    expect(rgbToColor([72, 209, 204])).toEqual("Light Blue");
    expect(rgbToColor([0, 206, 209])).toEqual("Light Blue");
    expect(rgbToColor([32, 178, 170])).toEqual("Light Blue");
    expect(rgbToColor([95, 158, 160])).toEqual("Light Blue");
});
test('RGB to final color: Blue Colors', () => {
    expect(rgbToColor([176, 196, 222])).toEqual("Light Blue");
    expect(rgbToColor([176, 224, 230])).toEqual("Light Blue");
    expect(rgbToColor([173, 216, 230])).toEqual("Light Blue");
    expect(rgbToColor([135, 206, 235])).toEqual("Light Blue");
    expect(rgbToColor([135, 206, 250])).toEqual("Light Blue");
    expect(rgbToColor([0, 191, 255])).toEqual("Light Blue");
    expect(rgbToColor([30, 144, 255])).toEqual("Light Blue");
    expect(rgbToColor([100, 149, 237])).toEqual("Light Blue");
    expect(rgbToColor([70, 130, 180])).toEqual("Light Blue");
    expect(rgbToColor([65, 105, 225])).toEqual("Light Blue");
    expect(rgbToColor([0, 0, 255])).toEqual("Blue");
    expect(rgbToColor([0, 0, 205])).toEqual("Blue");
    expect(rgbToColor([0, 0, 139])).toEqual("Dark Blue");
    expect(rgbToColor([0, 0, 128])).toEqual("Dark Blue");
    expect(rgbToColor([25, 25, 112])).toEqual("Dark Blue");
});
test('RGB to final color: Purple Colors', () => {
    expect(rgbToColor([216, 191, 216])).toEqual("Light Purple");
    expect(rgbToColor([221, 160, 221])).toEqual("Light Purple");
    expect(rgbToColor([238, 130, 238])).toEqual("Light Purple");
    expect(rgbToColor([218, 112, 214])).toEqual("Light Purple");
    expect(rgbToColor([255, 0, 255])).toEqual("Light Purple");
    expect(rgbToColor([186, 85, 211])).toEqual("Light Purple");
    expect(rgbToColor([147, 112, 219])).toEqual("Light Purple");
    expect(rgbToColor([138, 43, 226])).toEqual("Purple");
    expect(rgbToColor([148, 0, 211])).toEqual("Purple");
    expect(rgbToColor([153, 50, 204])).toEqual("Purple");
    expect(rgbToColor([139, 0, 139])).toEqual("Purple");
    expect(rgbToColor([128, 0, 128])).toEqual("Purple");
    expect(rgbToColor([75, 0, 130])).toEqual("Dark Purple");
});
test('RGB to final color: White Colors', () => {
    expect(rgbToColor([255, 255, 255])).toEqual("White");
    expect(rgbToColor([255, 250, 250])).toEqual("White");
    expect(rgbToColor([240, 255, 240])).toEqual("White");
    expect(rgbToColor([245, 255, 250])).toEqual("White");
    expect(rgbToColor([240, 255, 255])).toEqual("White");
    expect(rgbToColor([240, 248, 255])).toEqual("White");
});
test('RGB to final color: Gray and Black Colors', () => {
    expect(rgbToColor([220, 220, 220])).toEqual("Light Gray");
    expect(rgbToColor([211, 211, 211])).toEqual("Light Gray");
    expect(rgbToColor([192, 192, 192])).toEqual("Light Gray");
    expect(rgbToColor([169, 169, 169])).toEqual("Gray");
    expect(rgbToColor([128, 128, 128])).toEqual("Gray");
    expect(rgbToColor([105, 105, 105])).toEqual("Dark Gray");
    expect(rgbToColor([0, 0, 0])).toEqual("Black");
});
/*
test('HSV to final color', () => {
    expect(HSVtoColor([0,1,1])).toEqual("red");
    expect(HSVtoColor([0,0,0])).toEqual("black");
    expect(HSVtoColor([60,1,1])).toEqual("yellow");
    expect(HSVtoColor([120,1,1])).toEqual("green");
    expect(HSVtoColor([180,1,1])).toEqual("cyan");
    expect(HSVtoColor([300,1,1])).toEqual("purple");
    expect(HSVtoColor([240,1,1])).toEqual("blue");
    expect(HSVtoColor([180,1,1])).toEqual("cyan");
    expect(HSVtoColor([14,1,1])).toEqual("red");
    expect(HSVtoColor([0,0,0.5])).toEqual("grey");

});
*/