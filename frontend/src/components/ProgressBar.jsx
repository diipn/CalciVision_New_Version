import { Progress } from "radix-ui";

export default function ProgressBar({ progress=0 }) {
	
    return (
        <Progress.Root
            className="relative h-5 w-70 overflow-hidden rounded-full bg-red-soft"
            style={{ transform: "translateZ(0)" }} // Prevenir overflow em browsers como Safari
            value={progress}
            max={100}
        >
            <Progress.Indicator 
                className="ease-[cubic-bezier(0.65, 0, 0.35, 1)] size-full bg-red transition-transform duration-[660ms]"
				style={{ transform: `translateX(-${100 - progress}%)` }}
            />
        </Progress.Root>
    )
}
