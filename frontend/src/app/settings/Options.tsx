"use client";
import {useState,useEffect} from "react";
import Loader from "../loader";
import OptionType from "./OptionType";
export type Options = {
  [key: string]: any;
};


export default function Options() {
    const apiUrl = (path: string) => `http://${window.location.hostname}:7000${path}`;

    const saveOptions = async () => {
        if (disabledSave) return;
        if (!options || Object.keys(options).length === 0) return;
        setLoading(true);
        await fetch(apiUrl("/updateOptions"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(options)
        });
        setLoadedOptions(options);
        setLoading(false);
    };
    const [loadedOptions, setLoadedOptions] = useState<Options>({});
    const [options, setOptions] = useState<Options>({});
    const [disabledSave, setDisabledSave] = useState(true);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        setDisabledSave(JSON.stringify(options) === JSON.stringify(loadedOptions));
    }, [options, loadedOptions]);

    useEffect(() => {
        const fetchOptions = async () => {
            const res = await fetch(apiUrl("/getOptions"));
            const data = await res.json();
            setLoadedOptions(data);
            setOptions(data);
        };
        fetchOptions();
    }, []);

    return (
        <div className="mt-4 flex flex-col">
            <OptionType typeKey="sticky_media_info" value={options["sticky_media_info"] || false} type="<boolean>" onChange={(newValue) => setOptions((prev) => ({ ...prev, sticky_media_info: newValue }))} />
            <OptionType typeKey="logs_page_size" value={options["logs_page_size"] || 0} type="<number>" min={1} onChange={(newValue) => setOptions((prev) => ({ ...prev, logs_page_size: newValue }))} />
            <OptionType typeKey="download_mode" value={options["download_mode"] || ""} type="<dropdown>" options={[{key: "serial", value: "Serial"}, {key: "parallel", value: "Parallel"}]} onChange={(newValue) => setOptions((prev) => ({ ...prev, download_mode: newValue }))} />
            <OptionType typeKey="subtitle_languages" value={options["subtitle_languages"] || ""} type="<string>" onChange={(newValue) => setOptions((prev) => ({ ...prev, subtitle_languages: newValue }))} />

            <div className="flex justify-end">
                <button onClick={saveOptions} disabled={disabledSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
            {loading && <Loader />}
        </div>
    );
}