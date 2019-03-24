import {html} from 'malevic';

import {CheckBox, UpDown, Toggle, Select, CustToggle, Button} from '../../../controls';

import {getLocalMessage} from '../../../../utils/locales';
import {FilterConfig} from '../../../../definitions';
import {ColorblindnessType, ColorCorrectionType} from '../../../../generators/css-filter'

//most of this taken from fontsettings

interface CbSettingsProps {
    config: FilterConfig;
    fonts: string[];
    onChange: (config: Partial<FilterConfig>) => void;
}

const colorblindnessTypes = [
    { 
        "id": ColorblindnessType.deuteranopia, 
        "text": "Deuteranopia", // (Red/Green - poor Green)",
        "corrections": [
            ColorCorrectionType.lmsDaltonization,
            ColorCorrectionType.lab
        ] 
    },
    {
        "id": ColorblindnessType.protanopia, 
        "text": "Protanopia", // (Red/Green - poor Red)",
        "corrections": [
            ColorCorrectionType.lmsDaltonization,
            ColorCorrectionType.cbFilterService
        ] 
    },
    { 
        "id": ColorblindnessType.tritanopia, 
        "text": "Tritanopia", // (Yellow/Blue)",
        "corrections": [
            ColorCorrectionType.lmsDaltonization,
            ColorCorrectionType.shift
        ]
    }
];

const colorCorrectionTypes = [
    { "id": ColorCorrectionType.lmsDaltonization, "text": "LMS Daltonization" },
    { "id": ColorCorrectionType.cbFilterService, "text": "CBFS Method" },
    { "id": ColorCorrectionType.lab, "text": "LAB Method" },
    { "id": ColorCorrectionType.shift, "text": "Shifting Method" }
];

export default function CBSettings({config, fonts, onChange}: CbSettingsProps) {
    return (
        <section class="cb-settings">
            <div class="cb-settings__cb-select-container">
                <div class="cb-settings__cb-select-container__line">
                    <CheckBox
                        checked={config.useColorCorrection}
                        onchange={(e) => onChange({useColorCorrection: e.target.checked})}
                    />
                    <Select
                        value={colorblindnessTypes.find(x => x.id == config.colorblindnessType).text}
                        //onChange={(value) => onChange({colorblindnessType: colorblindnessTypes.find(x => x.text == value).id})}
                        onChange={(value) => onChange({colorblindnessType: value})}
                        options={colorblindnessTypes.reduce((map, x) => {
                            map[x.id] = (
                                <div>
                                    {x.text}
                                </div>
                            );
                            return map;
                        }, {} as {[text: string]: Malevic.NodeDeclaration;})}
                    />
                </div>
                <label class="cb-settings__cb-select-container__label">
                    {getLocalMessage('enable_cb')}
                </label>
                <UpDown
                    value={config.colorblindnessSensitivity * 100}
                    min={0}
                    max={100}
                    step={10}
                    default={0}
                    name={getLocalMessage('sensitivity')}
                    onChange={(value) => onChange({colorblindnessSensitivity: value / 100})}
                />
            </div>


            <div style="display:flex; justify-content:center; width:97%; text-align:center;">
                <div>
                    <input class="jscolor jscolor-active" style="width:80px" value={config.unclickedColor} name="unclicked" onchange={(value) => onChange({unclickedColor: value.target.value})} />
                    <label class="cb-settings__cb-select-container__label">
                        {getLocalMessage('unvisited_link')}
                    </label>
                </div>
                <CheckBox
                    checked={config.linkColor}
                    onchange={(e) => onChange({linkColor: e.target.checked})}
                />
                <div>
                    <input class="jscolor jscolor-active" style="width:80px" value={config.clickedColor} name="clicked" onchange={(value) => onChange({clickedColor: value.target.value})}/>
                    <label class="cb-settings__cb-select-container__label">
                        {getLocalMessage('visited_link')}
                    </label>
                </div>
            </div>
            <script>window.jscolor.installByClassName("jscolor")</script> 

            <CustToggle

                //class="site-list-settings__toggle"
                checked={true}
                labelOn={getLocalMessage('enable_color_hover')}
                labelOff={getLocalMessage('disable_color_hover')}
                onChange={(value) => 0}
                //onChange = {printName}
            />
            
        </section>
        
    );
}
