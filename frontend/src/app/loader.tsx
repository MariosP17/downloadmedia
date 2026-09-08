export default function Loader() {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
        <span className="loader"></span>
        <span className="ml-4 text-lg">Loading...</span>
    </div>
  );
}
