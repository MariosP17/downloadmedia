interface ComponentLoaderProps {
  name?: string;
}
export default function ComponentLoader({ name }: ComponentLoaderProps) { 
  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex flex-col gap-1 items-center justify-center rounded-lg">
        <div className="component-loader"></div>
        <span className="ml-4 text-lg text-white">Loading {name || "Component"}...</span>
    </div>
  );
}