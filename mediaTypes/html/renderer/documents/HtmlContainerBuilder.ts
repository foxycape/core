import { createElement } from "../../../../kernal/html/injector";
import { getRandomId } from "../../../../kernal/common/uuid";
import { Theme } from "../../../../kernal";
import { HtmlSettings } from "../../HtmlSettings";
import { HtmlOptions } from "../../HtmlOptions";
import { HOST_LAYOUT_CSS } from "../layout/css/hostLayoutCss";

export class HtmlContainerBuilder {
    private readonly htmlOptions: HtmlOptions;
    constructor(htmlOptions: HtmlOptions) {
        this.htmlOptions = htmlOptions;
    }

    createContainers() {
        const rendererContainer = createElement(document, "div", getRandomId(true), "renderer");
        rendererContainer.classList.add(Theme.customScrollerClassName);
        rendererContainer.setAttribute("data-role", "renderer-container");

        const contentsContainer = createElement(document, "div", getRandomId(true), HtmlSettings.ContentsContainerCssName);
        contentsContainer.setAttribute("data-role", "contents-container");

        const contentsContainerShadow = createElement(document, "div", getRandomId(true), HtmlSettings.ContentsShadowContainerCssName);
        const transformContainer = createElement(document, "div", getRandomId(true), HtmlSettings.TransformContainerCssName);
        if (this.htmlOptions.flipPageStyle == "slide") {
            transformContainer.classList.add("slide");
        }
        contentsContainerShadow.appendChild(transformContainer);
        contentsContainer.appendChild(contentsContainerShadow);
        rendererContainer.appendChild(contentsContainer);

        return {
            rendererContainer,
            rendererCss: HOST_LAYOUT_CSS,
            otherCss: "",
            contentsContainer,
            transformContainer,
        };
    }
}
