import { AlertDialog } from 'radix-ui'

export default function AlertDialogMenu({ children, heading, content, hasCancel=true, confirmText="Confirm", onConfirm }) {
    
    return (
        <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
                {children}
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 bg-black/20 data-[state=open]:animate-overlayShow"  />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-[25px] focus:outline-none data-[state=open]:animate-contentShow">
                    <AlertDialog.Title className="m-0 text-xl font-medium text-gray-dark">
                        {heading}
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mb-5 mt-5 text-md leading-normal text-gray-dark" asChild>
                        <div className='pt-1 pb-3'>{content}</div>
                    </AlertDialog.Description>
                    <div className="flex justify-end gap-8">
                        {hasCancel && (
                            <AlertDialog.Cancel asChild>
                                <button className="inline-flex h-[35px] items-center justify-center rounded px-[15px] font-medium leading-none text-red-dark select-none">
                                    Cancel
                                </button>
                            </AlertDialog.Cancel>
                        )}
                        <AlertDialog.Action asChild>
                            <button 
                                className="inline-flex min-w-20 h-[35px] items-center justify-center rounded bg-red-soft px-[15px] font-medium leading-none text-red-dark outline-none outline-offset-1 hover:bg-red hover:text-white focus-visible:outline-2 select-none"
                                onClick={onConfirm}
                            >
                                {confirmText}
                            </button>
                        </AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    )
}