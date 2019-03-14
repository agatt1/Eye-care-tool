import {html} from 'malevic';
import {CheckBox, UpDown, Toggle, Select, CustToggle, Button} from '../../../controls';
import {getLocalMessage} from '../../../../utils/locales';
import {FilterConfig} from '../../../../definitions';
import {hoverFunOld, enableHoverFun, hoverFun} from '../cb-settings/hoverFunctions'

//most of this taken from fontsettings

interface FontSettingsProps {
    config: FilterConfig;
    fonts: string[];
    onChange: (config: Partial<FilterConfig>) => void;
}



const myObj = [{"id":"Red/Green","text":"Red/Green"},{"id":"Yellow/Blue","text":"Yellow/Blue"}, {"id":"Mono","text":"Mono"}];

const selectedIds = myObj.map(({ id }) => id);

export default function CBSettings({config, fonts, onChange}: FontSettingsProps) {
    return (
        <section class="font-settings">
            <div class="font-settings__font-select-container">
                <div class="font-settings__font-select-container__line">
                    <CheckBox
                        checked={config.useFont}
                        //onchange={(e) => onChange({useFont: e.target.checked})}
                    />
                    <Select
                        value={"Red/Green"}
                        //onChange={(value) => onChange({fontFamily: value})}
                        options={selectedIds}
                    />
                    
                </div>
                <label class="font-settings__font-select-container__label">
                    {getLocalMessage('select_type_of_cb')}
                </label>
            </div>
            <UpDown
                value={config.dummy_val}
                min={0}
                max={1}
                step={0.1}
                default={0}
                name={getLocalMessage('sensitivity')}
                onChange={(value) => onChange({dummy_val: value})}
                //onChange={(value) =>0}
            />
            
            <CustToggle
                //class="site-list-settings__toggle"
                checked={true}
                labelOn={getLocalMessage('disable_color_hover')}
                labelOff={getLocalMessage('enable_color_hover')}
                onChange={() => enableHoverFun()}
                
            />

            <Button
                onclick={() => hoverFun()}
            >
                HOVER
            </Button>

        </section>
        
    );
}

//<button id = "hoverButton" onClick = "hoverFun()">HOVER</button>
//<input type="button" value="Click" onClick = "console.log('test')"></input>