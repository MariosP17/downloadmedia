"use client";
import {useState,useEffect} from "react";
import Loader from "../loader";
import OptionType from "./OptionType";
export type Configuration = {
  [key: string]: any;
};


export default function Configuration() {
    const apiUrl = (path: string) => `http://${window.location.hostname}:7000${path}`;

    const saveConfiguration = async () => {
        if (disabledSave) return;
        if (!config || Object.keys(config).length === 0) return;
        setLoading(true);
        await fetch(apiUrl("/updateConfiguration"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(config)
        });
        setLoadedConfig(config);
        setLoading(false);
    };
    const [loadedConfig, setLoadedConfig] = useState<Configuration>({});
    const [config, setConfig] = useState<Configuration>({});
    const [disabledSave, setDisabledSave] = useState(true);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        setDisabledSave(JSON.stringify(config) === JSON.stringify(loadedConfig));
    }, [config, loadedConfig]);

    useEffect(() => {
        const fetchOptions = async () => {
            const res = await fetch(apiUrl("/getConfiguration"));
            const data = await res.json();
            setLoadedConfig(data);
            setConfig(data);
        };
        fetchOptions();
    }, []);

    return (
        <div className="mt-4 flex flex-col">
            <OptionType typeKey="MoviesFolder" value={config["MoviesFolder"] || ""} type="<string>" onChange={(newValue) => setConfig((prev) => ({ ...prev, MoviesFolder: newValue }))} />
            <OptionType typeKey="TVShowsFolder" value={config["TVShowsFolder"] || ""} type="<string>" onChange={(newValue) => setConfig((prev) => ({ ...prev, TVShowsFolder: newValue }))} />
            <OptionType typeKey="MediaFolder" value={config["MediaFolder"] || ""} type="<string>" onChange={(newValue) => setConfig((prev) => ({ ...prev, MediaFolder: newValue }))} />
            

            <div className="flex justify-end">
                <button onClick={saveConfiguration} disabled={disabledSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
            {loading && <Loader />}
        </div>
    );
}