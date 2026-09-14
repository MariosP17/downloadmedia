"use client";
import {useState,useEffect} from "react";
import Loader from "../loader";
import OptionType from "./OptionType";
export type Options = {
  [key: string]: any;
};


export default function Options() {

    const saveOptions = async () => {
        if (disabledSave) return;
        if (!options || Object.keys(options).length === 0) return;
        setLoading(true);
        const BASE_URL = `http://${window.location.hostname}:7000/`;
        await fetch(BASE_URL+"updateOptions", {
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
            const BASE_URL = `http://${window.location.hostname}:7000/`;
            const res = await fetch(BASE_URL+"getOptions");
            const data = await res.json();
            setLoadedOptions(data);
            setOptions(data);
        };
        fetchOptions();
    }, []);

    return (
        <div className="mt-4 flex flex-col">
            <OptionType typeKey="sticky_media_info" value={options["sticky_media_info"] || false} type="<boolean>" onChange={(newValue) => setOptions((prev) => ({ ...prev, sticky_media_info: newValue }))} />
            
            <div className="flex justify-end">
                <button onClick={saveOptions} disabled={disabledSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
            {loading && <Loader />}
        </div>
    );
}