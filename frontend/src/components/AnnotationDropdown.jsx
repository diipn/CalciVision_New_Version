import { DropdownMenu } from "radix-ui";

export default function AnnotationDropdown({ children, handleDectectValve, toggleDrawingMode, annotated }) {

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                {children}
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal className="rounded-b-sm shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]">
                <DropdownMenu.Content className="bg-white min-w-30 w-55 p-1 space-y-1" align="start" sideOffset={5}>
                    <DropdownMenu.Item 
                        className="group p-2 pl-4 rounded-sm flex items-center gap-4 relative select-none leading-none text-gray-dark outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-red data-[disabled]:text-gray-dark data-[highlighted]:text-white cursor-pointer"
                        onClick={handleDectectValve}
                        title="AI Valve Detection Tool"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 14 14"><path fill="currentColor" fillRule="evenodd" d="M2.856.654c.19-.868 1.427-.874 1.625-.007l.01.044l.02.086a2.69 2.69 0 0 0 2.16 2.037c.905.157.905 1.457 0 1.614a2.69 2.69 0 0 0-2.164 2.054l-.026.113c-.198.867-1.434.861-1.625-.007l-.02-.097A2.68 2.68 0 0 0 .68 4.427c-.904-.158-.904-1.454 0-1.612A2.68 2.68 0 0 0 2.833.762l.016-.071zm7.78 2.962a1.5 1.5 0 0 1 1.652.333l.002.001l1.266 1.277a1.5 1.5 0 0 1 0 2.126l-.002.002l-6.197 6.237a.5.5 0 0 1-.312.146l-3 .26a.5.5 0 0 1-.541-.541l.26-3a.5.5 0 0 1 .146-.312l6.237-6.197a1.5 1.5 0 0 1 .488-.332Z" clipRule="evenodd"></path></svg>
                        <span role='tooltip'>AI Detection</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item 
                        className="group p-2 pl-4 rounded-sm flex items-center gap-4 relative select-none leading-none text-gray-dark outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-red data-[disabled]:text-gray-medium data-[highlighted]:text-white cursor-pointer"
                        onClick={toggleDrawingMode}
                        disabled={annotated}
                        title="Aortic Valve Segmentation"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 16 16"><path fill="currentColor" d="m7.9 7.9l2.1 7.5l1.7-2.6l3.2 3.2l1.1-1.1l-3.3-3.2l2.7-1.6z"></path><path fill="currentColor" d="M8 12H1V3h12v5.4l1 .2V2H0v11h8.2z"></path></svg>
                        <span role='tooltip'>Manual Selection</span>
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}