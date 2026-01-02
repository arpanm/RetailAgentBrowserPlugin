import { StubPlatform } from "./platform-stub-template.js";

export default class ZeptoPlatform extends StubPlatform {
    constructor() {
        super("zepto", ["zepto.com", "www.zepto.com"]);
    }
}

