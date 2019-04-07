import {parse, hslToRGB, rgbToHSL, rgbToString, rgbToHexString, hslToString, HSLA} from '../src/utils/color';
import { Matrix, applyColorMatrix } from '../src/generators/utils/matrix';

test('Color parsing', () => {
    expect(parse('rgb(255,0,153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255, 0, 153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(100%,0%,60%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(100%, 0%, 60%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255 0 153)')).toEqual({r: 255, g: 0, b: 153, a: 1});

    expect(parse('rgb(255, 0, 153, 1)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255, 0, 153, 100%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255 0 153 / 1)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255 0 153 / 100%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255, 0, 153.6, 1)')).toEqual({r: 255, g: 0, b: 154, a: 1});
    expect(parse('rgb(1e2, .5e1, .5e0, +.25e2%)')).toEqual({r: 100, g: 5, b: 1, a: 0.25});

    expect(parse('rgba(51, 170, 51, .1)')).toEqual({r: 51, g: 170, b: 51, a: 0.1});
    expect(parse('rgba(51, 170, 51, .4)')).toEqual({r: 51, g: 170, b: 51, a: 0.4});
    expect(parse('rgba(51, 170, 51, .7)')).toEqual({r: 51, g: 170, b: 51, a: 0.7});
    expect(parse('rgba(51, 170, 51, 1)')).toEqual({r: 51, g: 170, b: 51, a: 1});
    expect(parse('rgba(51 170 51 / 0.4)')).toEqual({r: 51, g: 170, b: 51, a: 0.4});
    expect(parse('rgba(51 170 51 / 40%)')).toEqual({r: 51, g: 170, b: 51, a: 0.4});
    expect(parse('rgba(255, 0, 153.6, 1)')).toEqual({r: 255, g: 0, b: 154, a: 1});
    expect(parse('rgba(1e2, .5e1, .5e0, +.25e2%)')).toEqual({r: 100, g: 5, b: 1, a: 0.25});

    expect(parse('hsl(270,60%,70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(270, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(270 60% 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(270deg, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(4.71239rad, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(.75turn, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});

    expect(parse('hsl(270, 60%, 50%, .15)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});
    expect(parse('hsl(270, 60%, 50%, 15%)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});
    expect(parse('hsl(270 60% 50% / .15)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});
    expect(parse('hsl(270 60% 50% / 15%)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});

    expect(parse('hsla(240, 100%, 50%, .05)')).toEqual({r: 0, g: 0, b: 255, a: 0.05});
    expect(parse('hsla(240, 100%, 50%, .4)')).toEqual({r: 0, g: 0, b: 255, a: 0.4});
    expect(parse('hsla(240, 100%, 50%, .7)')).toEqual({r: 0, g: 0, b: 255, a: 0.7});
    expect(parse('hsla(240, 100%, 50%, 1)')).toEqual({r: 0, g: 0, b: 255, a: 1});
    expect(parse('hsla(240 100% 50% / .05)')).toEqual({r: 0, g: 0, b: 255, a: 0.05});
    expect(parse('hsla(240 100% 50% / 5%)')).toEqual({r: 0, g: 0, b: 255, a: 0.05});

    expect(parse('#f09')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('#F09')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('#ff0099')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('#FF0099')).toEqual({r: 255, g: 0, b: 153, a: 1});

    expect(parse('#3a30')).toEqual({r: 51, g: 170, b: 51, a: 0});
    expect(parse('#3A3F')).toEqual({r: 51, g: 170, b: 51, a: 1});
    expect(parse('#33aa3300')).toEqual({r: 51, g: 170, b: 51, a: 0});
    expect(parse('#33AA3388')).toEqual({r: 51, g: 170, b: 51, a: 136 / 255});

    expect(parse('rebeccapurple')).toEqual({r: 102, g: 51, b: 153, a: 1});

    expect(parse('transparent')).toEqual({r: 0, g: 0, b: 0, a: 0});

    expect(parse('InfoBackground')).toEqual({r: 251, g: 252, b: 197, a: 1});
    expect(parse('-webkit-focus-ring-color')).toEqual({r: 229, g: 151, b: 0, a: 1});

    expect(() => parse('sponge')).toThrow('Unable to parse sponge');
    expect(() => parse('hsl(0, 0%, 0%) rgb(0, 0, 0)')).toThrow('Unable to parse hsl(0, 0%, 0%) rgb(0, 0, 0)');
    expect(() => parse('#hello')).toThrow('Unable to parse #hello');
});

test('Stringify color', () => {
    expect(rgbToString({r: 255, g: 0, b: 153})).toEqual('rgb(255, 0, 153)');
    expect(rgbToString({r: 255, g: 0, b: 153, a: 1})).toEqual('rgb(255, 0, 153)');
    expect(rgbToString({r: 255, g: 0, b: 153, a: 0.25003})).toEqual('rgba(255, 0, 153, 0.25)');

    expect(rgbToHexString({r: 255, g: 0, b: 153})).toEqual('#ff0099');
    expect(rgbToHexString({r: 255, g: 0, b: 153, a: 1})).toEqual('#ff0099');
    expect(rgbToHexString({r: 255, g: 0, b: 153, a: 0.25003})).toEqual('#ff009940');

    expect(hslToString({h: 270, s: 0.6, l: 0.7})).toEqual('hsl(270, 60%, 70%)');
    expect(hslToString({h: 270, s: 0.6, l: 0.7, a: 1})).toEqual('hsl(270, 60%, 70%)');
    expect(hslToString({h: 270.25, s: 0.5988, l: 0.702, a: 0.33333})).toEqual('hsla(270, 60%, 70%, 0.33)');
    expect(hslToString({h: 270.25, s: 0.5988, l: 0.702, a: 0.00032})).toEqual('hsla(270, 60%, 70%, 0)');
});

test('Color conversion', () => {
    expect(hslToRGB({h: 180, s: 1, l: 0.5, a: 0.25})).toEqual({r: 0, g: 255, b: 255, a: 0.25});
    expect(hslToRGB({h: 0, s: 1, l: 0.25, a: 0.5})).toEqual({r: 128, g: 0, b: 0, a: 0.5});
    expect(hslToRGB({h: 12, s: 0.78, l: 0.61})).toEqual({r: 233, g: 109, b: 78, a: 1});
    expect(hslToRGB({h: 192, s: 0.57, l: 0.10})).toEqual({r: 11, g: 34, b: 40, a: 1});
    expect(hslToRGB({h: 0, s: 0, l: 0.5})).toEqual({r: 128, g: 128, b: 128, a: 1});

    const round = (color: HSLA) => Object.entries(color).reduce((c, [k, v]) => (c[k] = k === 'h' ? Math.round(v) : Math.round(v * 100) / 100, c), {} as HSLA)
    expect(round(rgbToHSL({r: 0, g: 255, b: 255, a: 0.25}))).toEqual({h: 180, s: 1, l: 0.5, a: 0.25});
    expect(round(rgbToHSL({r: 128, g: 0, b: 0, a: 0.5}))).toEqual({h: 0, s: 1, l: 0.25, a: 0.5});
    expect(round(rgbToHSL({r: 233, g: 109, b: 78}))).toEqual({h: 12, s: 0.78, l: 0.61, a: 1});
    expect(round(rgbToHSL({r: 11, g: 34, b: 40}))).toEqual({h: 192, s: 0.57, l: 0.10, a: 1});
    expect(round(rgbToHSL({r: 161, g: 28, b: 61}))).toEqual({h: 345, s: 0.7, l: 0.37, a: 1});
});

test('Colorblindness correction', () => {
    var deuteranopiaMatrix = Matrix.fullCorrectionDeuteranopia(1.0);
    expect(applyColorMatrix([206, 121, 117], deuteranopiaMatrix)).toEqual([249, 121, 101]);
    expect(applyColorMatrix([255, 178, 124], deuteranopiaMatrix)).toEqual([255, 178, 110]);
    expect(applyColorMatrix([255, 250, 141], deuteranopiaMatrix)).toEqual([255, 250, 140]);
    expect(applyColorMatrix([184, 208, 120], deuteranopiaMatrix)).toEqual([172, 208, 124]);
    expect(applyColorMatrix([140, 215, 159], deuteranopiaMatrix)).toEqual([102, 215, 173]);
    expect(applyColorMatrix([132, 211, 219], deuteranopiaMatrix)).toEqual([92, 211, 233]);
    expect(applyColorMatrix([211, 190, 231], deuteranopiaMatrix)).toEqual([222, 190, 227]);
    expect(applyColorMatrix([237, 182, 220], deuteranopiaMatrix)).toEqual([255, 182, 210]);
    expect(applyColorMatrix([255, 175, 204], deuteranopiaMatrix)).toEqual([255, 175, 189]);

    var protanopiaMatrix = Matrix.fullCorrectionProtanopia(1.0);
    expect(applyColorMatrix([206, 121, 117], protanopiaMatrix)).toEqual([206, 164, 169]);
    expect(applyColorMatrix([255, 178, 124], protanopiaMatrix)).toEqual([255, 217, 172]);
    expect(applyColorMatrix([255, 250, 141], protanopiaMatrix)).toEqual([255, 253, 144]);
    expect(applyColorMatrix([184, 208, 120], protanopiaMatrix)).toEqual([184, 196, 105]);
    expect(applyColorMatrix([140, 215, 159], protanopiaMatrix)).toEqual([140, 177, 113]);
    expect(applyColorMatrix([132, 211, 219], protanopiaMatrix)).toEqual([132, 171, 170]);
    expect(applyColorMatrix([211, 190, 231], protanopiaMatrix)).toEqual([211, 201, 244]);
    expect(applyColorMatrix([237, 182, 220], protanopiaMatrix)).toEqual([237, 210, 254]);
    expect(applyColorMatrix([255, 175, 204], protanopiaMatrix)).toEqual([255, 216, 253]);

    var tritanopiaMatrix = Matrix.fullCorrectionTritanopia(1.0);
    expect(applyColorMatrix([206, 121, 117], tritanopiaMatrix)).toEqual([255, 255, 117]);
    expect(applyColorMatrix([255, 178, 124], tritanopiaMatrix)).toEqual([255, 255, 124]);
    expect(applyColorMatrix([255, 250, 141], tritanopiaMatrix)).toEqual([255, 255, 141]);
    expect(applyColorMatrix([184, 208, 120], tritanopiaMatrix)).toEqual([121, 169, 120]);
    expect(applyColorMatrix([140, 215, 159], tritanopiaMatrix)).toEqual([0, 94, 159]);
    expect(applyColorMatrix([132, 211, 219], tritanopiaMatrix)).toEqual([0, 83, 219]);
    expect(applyColorMatrix([211, 190, 231], tritanopiaMatrix)).toEqual([255, 224, 231]);
    expect(applyColorMatrix([237, 182, 220], tritanopiaMatrix)).toEqual([255, 255, 220]);
    expect(applyColorMatrix([255, 175, 204], tritanopiaMatrix)).toEqual([255, 255, 204]);
})