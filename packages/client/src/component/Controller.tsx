import React from "react";
import classNames from "classnames";
import {
    Play,
    Pause,
    ChevronLeft,
    ChevronRight,
    Sliders,
    Twitter,
    ThumbsDown
} from "react-feather";

import ExternalLink from "./ExternalLink";
import { ConfigI, Theme } from "./Config";
import { DisLike, DisLikeType } from "../db";

interface Props {
    state: Spotify.PlaybackState;
    player: Spotify.SpotifyPlayer;
}

interface State {
    disLike: boolean;
}

export default class Controller extends React.Component<Props, State> {
    private disLikes: DisLike;
    private config: ConfigI;

    constructor(props: Props) {
        super(props);

        this.config = JSON.parse(localStorage.config || "{}");
        this.disLikes = new DisLike();
        this.state = {
            disLike: false,
        };

        this.onUpdateConfig = this.onUpdateConfig.bind(this);
    }

    public componentDidMount() {
        window.addEventListener("storage", this.onUpdateConfig);
        this.onUpdateConfig();

        const currentTrack = this.props.state.track_window.current_track;
        this.onUpdateTrack({} as Spotify.Track, currentTrack);
    }

    public componentWillUnmount() {
        window.removeEventListener("storage", this.onUpdateConfig);
    }

    public componentDidUpdate(prevProps: Readonly<Props>) {
        const prevTrack = prevProps.state.track_window.current_track;
        const currentTrack = this.props.state.track_window.current_track;
        if (currentTrack.uri !== prevTrack.uri) {
            this.onUpdateTrack(prevTrack, currentTrack);
        }
    }

    private async onUpdateTrack(
        prevTrack: Spotify.Track,
        currentTrack: Spotify.Track
    ) {
        console.log(
            prevTrack.uri,
            "/",
            prevTrack.name,
            "->",
            currentTrack.uri,
            "/",
            currentTrack.name
        );
        const disLike = await this.disLikes.isDisLike(currentTrack);
        console.log(
            currentTrack.uri,
            ":",
            currentTrack.name,
            "=> dislike:",
            disLike
        );
        if (disLike && this.config.auto_skip) {
            // NOTE: 0秒で即スキップすると失敗することがある
            setTimeout(async () => {
                console.log("skip:", currentTrack.uri, "/", currentTrack.name);
                await this.props.player.nextTrack();

                // FIXME: そもそもspotifyがnextTrack()に失敗することがある？
                setTimeout(() => {
                    if (
                        this.props.state.track_window.current_track.uri ===
                        currentTrack.uri
                    ) {
                        console.log(
                            "skip seems failed, retrying:",
                            currentTrack.uri,
                            "/",
                            currentTrack.name
                        );
                        this.props.player.nextTrack();
                    }
                }, 2500);
            }, 1000);
        } else {
            this.setState({
                disLike,
            });
        }
    }

    private onUpdateConfig() {
        this.config = JSON.parse(localStorage.config || "{}");
        switch (this.config.theme) {
            case Theme.DARK:
                document.documentElement.classList.remove("theme-light");
                document.documentElement.classList.add("theme-dark");
                break;
            case Theme.LIGHT:
                document.documentElement.classList.add("theme-light");
                document.documentElement.classList.remove("theme-dark");
                break;
            default:
                // REF: https://github.com/ChanceArthur/tailwindcss-dark-mode/blob/master/prefers-dark.js
                if (
                    window.matchMedia &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches
                ) {
                    console.log(
                        "matchmedia:",
                        window.matchMedia("(prefers-color-scheme: dark)")
                            .matches
                    );
                    document.documentElement.classList.remove("theme-light");
                    document.documentElement.classList.add("theme-dark");
                } else {
                    document.documentElement.classList.add("theme-light");
                    document.documentElement.classList.remove("theme-dark");
                }
        }
        this.onUpdateTrack(
            {} as Spotify.Track,
            this.props.state.track_window.current_track
        );

        const customCssId = "custom-css";
        let customCssElement = document.querySelector(`#${customCssId}`);
        if (!customCssElement) {
            customCssElement = document.createElement("style") as Element;
            customCssElement.id = customCssId;
            document.body.appendChild(customCssElement);
        }
        customCssElement.innerHTML = this.config.customCss || "";
    }

    render() {
        const { state } = this.props;
        const track = state.track_window.current_track;
        return (
            <div
                className={classNames(
                    "controller-column",
                    "flex",
                    "items-center",
                    "select-none",
                    "bg-gray-200",
                    "border-t",
                    "dark:bg-gray-800",
                    "dark:border-gray-700"
                )}
            >
                <div
                    className={classNames(
                        "hover:text-gray-500",
                        "dark:hover:text-gray-600"
                    )}
                    onClick={async () => {
                        if (this.state.disLike) {
                            await this.disLikes.unset(DisLikeType.TRACK, track);
                            this.setState({
                                disLike: false,
                            });
                        } else {
                            await this.disLikes.set(DisLikeType.TRACK, track);
                            this.setState({
                                disLike: true,
                            });
                        }
                    }}
                >
                    <ThumbsDown
                        size={16}
                        style={{ opacity: this.state.disLike ? 1 : 0.3 }}
                    />
                </div>
                <div
                    className={classNames(
                        "flex-1",
                        "py-3",
                        "hover:text-gray-500",
                        "dark:hover:text-gray-600"
                    )}
                    onClick={async () => {
                        const currentState =
                            (await this.props.player.getCurrentState()) || null;
                        if (currentState && currentState.position < 5000) {
                            this.props.player.previousTrack();
                        }
                        this.props.player.seek(0);
                    }}
                >
                    <ChevronLeft size={16} />
                </div>
                <div
                    className={classNames(
                        "hover:text-gray-500",
                        "dark:hover:text-gray-600"
                    )}
                    onClick={() => {
                        this.props.player?.togglePlay();
                    }}
                >
                    {state.paused ? (
                        <Play className={classNames("filled")} size={20} />
                    ) : (
                        <Pause className={classNames("filled")} size={20} />
                    )}
                </div>
                <div
                    className={classNames(
                        "hover:text-gray-500",
                        "dark:hover:text-gray-600"
                    )}
                    onClick={() => {
                        this.props.player?.nextTrack();
                    }}
                >
                    <ChevronRight size={16} />
                </div>
                <div
                    className={classNames(
                        "hover:text-gray-500",
                        "dark:hover:text-gray-600"
                    )}
                    onClick={() => {
                        window.open(
                            "/config",
                            "_blank",
                            "toolbar=0,location=0,menubar=0,width=960,height=600"
                        );
                    }}
                >
                    <Sliders size={16} />
                </div>
                <ExternalLink
                    className={classNames(
                        "flex-none",
                        "h-full",
                        "px-8",
                        "hover:text-gray-500",
                        "dark:hover:text-gray-600"
                    )}
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                        `${track.name}\r\n${track.artists[0].name} - ${track.album.name}\r\nhttps://open.spotify.com/track/${track.id}`
                    )}`}
                >
                    <Twitter className={classNames("filled")} size={16} />
                </ExternalLink>
            </div>
        );
    }
}
