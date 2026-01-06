import { StubPlatform } from "./platform-stub-template.js";

export default class BlinkitPlatform extends StubPlatform {
    constructor() {
        super("blinkit", ["blinkit.com"]);
    }
}


