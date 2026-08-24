/** Mark category */
export type MarkType = "drawline" | "note" | "bookmark" | (string & {});

/** Drawline visual style */
export type MarkStyleName =
    | "mark_pen"
    | "wavy_line"
    | "underline_straight"
    | (string & {});

/** Query options for listing marks */
export type QueryMarkOptions = {
    /** Spine/document URL; PDF treats a pure numeric value as pageNumber */
    url?: string;
    types?: MarkType[];
    keyword?: string;
};

/** Style metadata for toolbar / UI */
export type MarkStyle = {
    markType: MarkType;
    styleName: MarkStyleName;
    /** CSS text injected for this style */
    classValue: string;
    /** Color shown on toolbar buttons */
    displayColor: string;
    /** Default draw color */
    defaultColor: string;
    displayTextKey: string;
    defaultDisplayText: string;
    order: number;
};

export type CreateMarkOptions = {
    type: MarkType;
    text: string;
    /** Selection range (text-based marks) */
    target: Range;
    styleName: MarkStyleName;
    customColor?: string;
    /** First image in the range (bookmarks that include or are only an image) */
    imageUrl?: string;
    /** 150x150 JPEG data URL for list / personal-center preview */
    thumbnail?: string;
};

export type FindMarkTarget = {
    element?: Element;
    offsetX?: number;
    offsetY?: number;
    /** Viewport coords of the content document (prefer over offsetX/Y). */
    clientX?: number;
    clientY?: number;
    pageNumber?: number;
};
