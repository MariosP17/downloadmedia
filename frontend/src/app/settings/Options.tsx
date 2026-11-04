"use client";
import {useState,useEffect} from "react";
import ComponentLoader from "../componentLoader";
import OptionType from "./OptionType";
import { toast } from "react-hot-toast";
import { getApiUrl } from "../Actions/RestApiConfig";

export type Options = {
  [key: string]: any;
};


export default function Options() {
    const [languages, setLanguages] = useState<string>();
    // const [loading, setLoading] = useState(false);
    

    const saveOptions = async () => {
        if (disabledSave) return;
        if (!options || Object.keys(options).length === 0) return;
        setLoading(true);
        await fetch(await getApiUrl(window.location.hostname, window.location.protocol) + "/updateOptions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(options)
        });
        setLoadedOptions(options);
        setLoading(false);
    };

    const fetchLanguages = async () => {
        try {
        setLoading(true);
            const res = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getLanguages`);
            const data = await res.json();
            if (data.success === false) throw new Error(data.message || "Failed to fetch languages");
            const array = data.data.map((lang: { name: string; code: string }) => ({ name: lang.name, code: lang.code }));
            setLanguages(data.data || []);
        } catch (error) {
            console.error("Error fetching languages:", error);
            toast.error("Error fetching languages: " + (error instanceof Error ? error.message : ""));
        } finally {
            setLoading(false);
        }
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
            try{
                setLoading(true);
                const res = await fetch(await getApiUrl(window.location.hostname, window.location.protocol) + "/getOptions");
                const data = await res.json();
                setLoadedOptions(data);
                setOptions(data);
            } catch (error) {
                console.error("Error fetching options:", error);
                toast.error("Error fetching options: " + (error instanceof Error ? error.message : ""));
            } finally {
                setLoading(false);
            }
        };
        fetchOptions();
        void fetchLanguages();
    }, []);
    return (
        <div className="relative mt-4 flex flex-col">
            <OptionType typeKey="sticky_media_info" value={options["sticky_media_info"] || false} type="<boolean>" onChange={(newValue) => setOptions((prev) => ({ ...prev, sticky_media_info: newValue }))} />
            <OptionType typeKey="logs_page_size" value={options["logs_page_size"] || 0} type="<number>" min={1} onChange={(newValue) => setOptions((prev) => ({ ...prev, logs_page_size: newValue }))} />
            <OptionType typeKey="download_mode" value={options["download_mode"] || ""} type="<dropdown>" options={[{key: "serial", value: "Serial"}, {key: "parallel", value: "Parallel"}]} onChange={(newValue) => setOptions((prev) => ({ ...prev, download_mode: newValue }))} />
            <OptionType typeKey="auto_download_subs" value={options["auto_download_subs"] || false} type="<boolean>" onChange={(newValue) => setOptions((prev) => ({ ...prev, auto_download_subs: newValue }))} />
            <OptionType typeKey="sticky_streams_scroller" value={options["sticky_streams_scroller"] || false} type="<boolean>" onChange={(newValue) => setOptions((prev) => ({ ...prev, sticky_streams_scroller: newValue }))} />
            <OptionType typeKey="sort_streams_by_size" value={options["sort_streams_by_size"] || "No"} type="<dropdown>" options={[{key: "No", value: "No"}, {key: "Ascending", value: "Ascending"}, {key: "Descending", value: "Descending"}]} onChange={(newValue) => setOptions((prev) => ({ ...prev, sort_streams_by_size: newValue }))} />
            <OptionType typeKey="show_embedded" value={options["show_embedded"] || false} type="<boolean>" onChange={(newValue) => setOptions((prev) => ({ ...prev, show_embedded: newValue }))} />
            <OptionType typeKey="subtitle_languages" value={languages || []} type="<languages>" />
            <OptionType typeKey="batchSizeThreshold" value={options["batchSizeThreshold"] || 0} type="<number>" min={1} onChange={(newValue) => setOptions((prev) => ({ ...prev, batchSizeThreshold: newValue }))} />
            <div className="flex justify-end">
                <button onClick={saveOptions} disabled={disabledSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
            {loading && <ComponentLoader name="Options" />}
        </div>
    );
}