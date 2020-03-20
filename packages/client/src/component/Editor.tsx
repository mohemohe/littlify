import React, { HTMLProps } from "react";
import CodeFlask, { options } from "codeflask";

export interface Props extends HTMLProps<HTMLDivElement> {
    options: options;
    code: string;
    onUpdate: (code: string) => void;
}

interface State {
    targetId: string;
}

function randomId() {
    return btoa(`${Math.random()}`).replace(/=/g, "");
}

export default class Editor extends React.Component<Props, State> {
    private codeFlask?: CodeFlask;

    constructor(props: Props) {
        super(props);

        this.state = {
            targetId: randomId(),
        };
        this.onUpdate = this.onUpdate.bind(this);
    }

    public componentDidMount(): void {
        this.setState(
            {
                targetId: randomId(),
            },
            () => {
                this.codeFlask = new CodeFlask(
                    `#${this.state.targetId}`,
                    this.props.options
                );
                this.codeFlask.onUpdate(this.onUpdate);
                this.codeFlask.updateCode(this.props.code);
            }
        );
    }

    public componentWillUnmount(): void {
        delete this.codeFlask;
    }

    public UNSAFE_componentWillReceiveProps(nextProps: Readonly<Props>): void {
        if (this.codeFlask?.getCode() !== nextProps.code || "") {
            this.codeFlask?.updateCode(nextProps.code || "");
        }
    }

    private onUpdate(code: string) {
        this.props.onUpdate(code);
    }

    public render() {
        return <div id={this.state.targetId} {...this.props} />;
    }
}
