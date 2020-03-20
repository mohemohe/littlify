import React from "react";
import classNames from "classnames";

import Artists from "./Artists";

interface Props {
    track: Spotify.Track;
}

export default class MiniTrack extends React.Component<Props, {}> {
    render() {
        return (
            <div className={classNames("mini-track", "flex", "h-12")}>
                <img
                    src={this.props.track.album.images[1].url}
                    className={classNames("h-full", "flex-grow-0")}
                />
                <div className={classNames("ml-2", "truncate", "w-full")}>
                    <div className={classNames("track-name")}>
                        {this.props.track.name}
                    </div>
                    <div
                        className={classNames(
                            "artists-name",
                            "text-sm",
                            "text-gray-700",
                            "dark:text-gray-500"
                        )}
                    >
                        <Artists artists={this.props.track.artists} /> -{" "}
                        <span className={"album-name"}>
                            {this.props.track.album.name}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}
