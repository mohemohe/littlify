import React from "react";
import classNames from "classnames";
import {
    Play,
    Pause,
    ChevronLeft,
    ChevronRight,
    Sliders,
    Twitter,
    ThumbsDown,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
} from "react-feather";

import ExternalLink from "./ExternalLink";
import { ConfigI, Theme } from "./Config";
import { DisLike, DisLikeType } from "../db";

interface Props {
    state: Spotify.PlaybackState;
    player: Spotify.SpotifyPlayer;
}

interface State {
    calculatedPosition: number;
    updatedPosition: number;
    onSeek: boolean;
    disLike: boolean;
    volume: number;
    mute: boolean;
}

const maxVolume = 1000;

export default class Controller extends React.Component<Props, State> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private intervalHandler?: any;
    private disLikes: DisLike;
    private config: ConfigI;

    constructor(props: Props) {
        super(props);

        this.config = JSON.parse(localStorage.config || "{}");
        this.disLikes = new DisLike();
        this.state = {
            calculatedPosition: 0,
            updatedPosition: 0,
            onSeek: false,
            disLike: false,
            volume: 0,
            mute: false,
        };
    }

    public componentDidMount() {
        this.setState({
            volume: parseFloat(localStorage.volume) * maxVolume,
            mute: localStorage.mute === `${true}`,
        });

        window.addEventListener("storage", this.onUpdateConfig);
        this.onUpdateConfig();

        const currentTrack = this.props.state.track_window.current_track;
        this.onUpdateTrack({} as Spotify.Track, currentTrack);
    }

    public componentWillUnmount() {
        window.removeEventListener("storage", this.onUpdateConfig);
    }

    public componentDidUpdate(
        prevProps: Readonly<Props>,
        prevState: Readonly<{}>,
        snapshot?: any
    ) {
        const prevTrack = prevProps.state.track_window.current_track;
        const currentTrack = this.props.state.track_window.current_track;
        if (currentTrack.uri !== prevTrack.uri) {
            this.onUpdateTrack(prevTrack, currentTrack);
        }
        if (this.props.state.paused || this.state.onSeek) {
            this.stopSeekBar();
        } else if (!this.props.state.paused && !this.intervalHandler) {
            this.startSeekBar();
        } else {
            // たぶん30秒ごとに飛んでくるstateで補正
            // REF: https://github.com/spotify/web-playback-sdk/issues/86
            let { calculatedPosition, updatedPosition } = this.state;
            if (this.props.state.position !== updatedPosition) {
                updatedPosition = this.props.state.position;
                calculatedPosition = this.props.state.position;
                this.setState({
                    calculatedPosition,
                    updatedPosition,
                });
            }
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

    private stopSeekBar() {
        clearInterval(this.intervalHandler);
        this.intervalHandler = undefined;
    }

    private startSeekBar() {
        const interval = 500;

        this.intervalHandler = setInterval(() => {
            let { calculatedPosition, updatedPosition } = this.state;
            if (this.props.state.position !== updatedPosition) {
                updatedPosition = this.props.state.position;
                calculatedPosition = this.props.state.position;
            } else {
                calculatedPosition += interval;
            }

            this.setState({
                calculatedPosition,
                updatedPosition,
            });
        }, interval);
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
        const customCssId = "custom-css";
        let customCssElement = document.querySelector(`#${customCssId}`);
        if (!customCssElement) {
            customCssElement = document.createElement("style") as Element;
            customCssElement.id = customCssId;
            document.body.appendChild(customCssElement);
        }
        customCssElement.innerHTML = this.config.customCss || "";

        this.onUpdateTrack(
            {} as Spotify.Track,
            this.props.state.track_window.current_track
        );
    }

    private onChangeVolume() {
        if (this.state.mute) {
            this.props.player.setVolume(0);
        } else {
            this.props.player.setVolume(this.state.volume / maxVolume);
        }
    }

    render() {
        const { state } = this.props;
        const track = state.track_window.current_track;
        return (
            <div
                className={classNames(
                    "controller-column",
                    "flex",
                    "bg-gray-200",
                    "border-t",
                    "dark:bg-gray-800",
                    "dark:border-gray-700"
                )}
            >
                <div
                    className={classNames(
                        "relative",
                        "flex",
                        "flex-1",
                        "items-center",
                        "select-none"
                    )}
                >
                    <input
                        id={"player-seekbar"}
                        className={classNames("input-bar")}
                        type="range"
                        min="0"
                        max={state.duration}
                        value={this.state.calculatedPosition}
                        onMouseDown={() => {
                            this.setState({
                                onSeek: true,
                            });
                        }}
                        onChange={e => {
                            this.setState({
                                calculatedPosition: parseInt(
                                    e.currentTarget.value,
                                    10
                                ),
                            });
                        }}
                        onMouseUp={e => {
                            this.props.player?.seek(
                                parseInt(e.currentTarget.value, 10)
                            );
                            this.setState({
                                onSeek: false,
                            });
                        }}
                    />
                    <div
                        className={classNames(
                            "dislike-button",
                            "hover:text-gray-500",
                            "dark:hover:text-gray-600"
                        )}
                        onClick={async () => {
                            if (this.state.disLike) {
                                await this.disLikes.unset(
                                    DisLikeType.TRACK,
                                    track
                                );
                                this.setState({
                                    disLike: false,
                                });
                            } else {
                                await this.disLikes.set(
                                    DisLikeType.TRACK,
                                    track
                                );
                                this.setState(
                                    {
                                        disLike: true,
                                    },
                                    () => {
                                        if (this.config.skip_at_dislike) {
                                            this.props.player?.nextTrack();
                                        }
                                    }
                                );
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
                            "rewind-button",
                            "flex-1",
                            "py-3",
                            "hover:text-gray-500",
                            "dark:hover:text-gray-600"
                        )}
                        onClick={async () => {
                            const currentState =
                                (await this.props.player.getCurrentState()) ||
                                null;
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
                            "play-pause-button",
                            state.paused ? "play-button" : "pause-button",
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
                            "forward-button",
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
                            "config-button",
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
                            "tweet-button",
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
                <div
                    className={classNames(
                        "w-25vw",
                        "relative",
                        "flex",
                        "items-center",
                        "select-none",
                        "border-l",
                        "dark:border-gray-700"
                    )}
                >
                    <div
                        className={classNames(
                            "mute-button",
                            "hover:text-gray-500",
                            "dark:hover:text-gray-600"
                        )}
                        onClick={async () => {
                            this.setState(
                                {
                                    mute: !this.state.mute,
                                },
                                () => {
                                    localStorage.setItem(
                                        "mute",
                                        `${this.state.mute}`
                                    );
                                    this.onChangeVolume();
                                }
                            );
                        }}
                    >
                        {this.state.mute && <VolumeX size={16} />}
                        {!this.state.mute &&
                            this.state.volume >= 0 &&
                            this.state.volume <= maxVolume / 3 && (
                                <Volume size={16} />
                            )}
                        {!this.state.mute &&
                            this.state.volume > maxVolume / 3 &&
                            this.state.volume <= (maxVolume / 3) * 2 && (
                                <Volume1 size={16} />
                            )}
                        {!this.state.mute &&
                            this.state.volume > (maxVolume / 3) * 2 && (
                                <Volume2 size={16} />
                            )}
                    </div>
                    <input
                        id={"player-volumebar"}
                        className={classNames("input-bar", "flex-1")}
                        type="range"
                        min={0}
                        max={maxVolume}
                        value={this.state.mute ? 0 : this.state.volume}
                        onChange={e => {
                            this.setState(
                                {
                                    volume: parseInt(e.currentTarget.value, 10),
                                    mute: false,
                                },
                                () => {
                                    localStorage.setItem(
                                        "volume",
                                        `${this.state.volume / maxVolume}`
                                    );
                                    this.onChangeVolume();
                                }
                            );
                        }}
                    />
                </div>
            </div>
        );
    }
}
