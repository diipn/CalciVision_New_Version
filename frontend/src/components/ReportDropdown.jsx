import { DropdownMenu } from "radix-ui";
import AlertDialogMenu from "./AlertDialogMenu";

export default function ReportDropdown({ children, report, handleDeleteReport }) {

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                {children}
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal className="rounded-b-sm shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]">
                <DropdownMenu.Content className="bg-gray-soft min-w-30 w-40 p-1 space-y-1 shadow-[0_3px_10px_rgb(0,0,0,0.2)]" align="end" sideOffset={5}>
                    <DropdownMenu.Item 
                        className="group p-2 pl-4 rounded-sm flex items-center gap-4 relative select-none leading-none text-gray-dark outline-none data-[disabled]:pointer-events-none data-[disabled]:text-gray-dark hover:bg-gray-pale cursor-pointer"
                        onClick={() => window.open(report.report_url)}
                    >
                        <div className='flex justify-between items-center w-full'>
                            <span role='tooltip'>Open</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4m-8-2l8-8m0 0v5m0-5h-5"></path></svg>
                        </div>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                        <AlertDialogMenu
                            heading='Delete Report'
                            content={`Are you sure you want to delete report "${report.pdf_name}"? This action cannot be undone.`}
                            onConfirm={() => handleDeleteReport(report.id)}
                        >
                            <button className="group p-2 pl-4 rounded-sm flex justify-between items-center gap-4 w-full text-red text-left select-none leading-none cursor-pointer hover:bg-red-pale">
                                <span>Delete</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 12 12"><path fill="currentColor" d="M5 3h2a1 1 0 0 0-2 0M4 3a2 2 0 1 1 4 0h2.5a.5.5 0 0 1 0 1h-.441l-.443 5.17A2 2 0 0 1 7.623 11H4.377a2 2 0 0 1-1.993-1.83L1.941 4H1.5a.5.5 0 0 1 0-1zm3.5 3a.5.5 0 0 0-1 0v2a.5.5 0 0 0 1 0zM5 5.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5M3.38 9.085a1 1 0 0 0 .997.915h3.246a1 1 0 0 0 .996-.915L9.055 4h-6.11z" /></svg>
                            </button>
                        </AlertDialogMenu>
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}
