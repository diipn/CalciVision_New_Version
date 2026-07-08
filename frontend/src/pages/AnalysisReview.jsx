import { useEffect, useState } from "react";
import { usePatientScreening } from "../hooks/usePatientScreening";
import MainLayout from "../layouts/MainLayout";
import AlertDialogMenu from "../components/AlertDialogMenu";

export default function AnalysisReview() {

    const [groupedTaks, setGroupedTaks] = useState({})
    
    const { 
        connectPatientScreening, 
        acceptPatientScreening, 
        cancelPatientScreening, 
        batches, 
        loading: loadingScreening, 
    } = usePatientScreening()

    useEffect(() => {
        (async () => {
            await connectPatientScreening()
        })()
    }, [])

    // Agrupa as tasks por paciente e ecocardiograma quando os batches são atualizados
    useEffect(() => {
        const updatedGroupedTasks = {}
        Object.values(batches).forEach(data => {
            const { patient, echo, frame_id } = data
            if(!updatedGroupedTasks[patient.name]) updatedGroupedTasks[patient.name] = {}
            if(!updatedGroupedTasks[patient.name][echo.description]) updatedGroupedTasks[patient.name][echo.description] = []
            updatedGroupedTasks[patient.name][echo.description].push({ 
                frame_id, 
                ...data 
            })
        })
        setGroupedTaks(updatedGroupedTasks)
        
    }, [batches])

    return (
        <MainLayout pageTitle="Analysis Review - CalciVision">
            <div>
                <h3 className="mb-8 w-full">Analysis Review</h3>
                {Object.keys(groupedTaks).length === 0 ? (
                    <Card className="p-6 text-center">
                        <p className="text-gray-medium">No patient screening data found.</p>
                        <p className="mt-2 text-sm">Start a new screening from the patient page.</p>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedTaks).map(([ patient, echos ]) =>
                            <Card key={patient} className="overflow-hidden">
                                <div className="bg-green p-4 text-white">
                                    <h4 className="text-xl font-medium">{patient}</h4>
                                </div>
                                <div className="p-4">
                                    {Object.entries(echos).map(([ echo, frames ]) =>
                                        <Accordion 
                                            key={echo}
                                            title={echo}
                                            first={Object.keys(echos).indexOf(echo) === 0}
                                            className="mb-2"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {frames.map((frame, idx) =>
                                                    <FrameCard key={idx} frame={frame} />
                                                )}
                                            </div>
                                        </Accordion>
                                    )}
                                </div>
                            </Card>
                        )}
                        <div className='flex gap-4 mt-8'>
                            {loadingScreening ? (
                                <AlertDialogMenu
                                    heading="Stop all processes?"
                                    content="Are you sure you want to stop all ongoing analysis? This will discard all changes made and can't be undone."
                                    onConfirm={() => cancelPatientScreening()}
                                >
                                    <button className="basis-48 flex items-center justify-center gap-2 bg-green-dark rounded-lg py-2 px-6 text-white">
                                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                                            <path fill="currentColor" d="m12 13.4l2.9 2.9q.275.275.7.275t.7-.275t.275-.7t-.275-.7L13.4 12l2.9-2.9q.275-.275.275-.7t-.275-.7t-.7-.275t-.7.275L12 10.6L9.1 7.7q-.275-.275-.7-.275t-.7.275t-.275.7t.275.7l2.9 2.9l-2.9 2.9q-.275.275-.275.7t.275.7t.7.275t.7-.275zm0 8.6q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"></path>
                                        </svg>
                                        Stop Screening
                                    </button>
                                </AlertDialogMenu>
                            ) : (
                                <>
                                    <AlertDialogMenu
                                        heading="Discard changes?"
                                        content="Are you sure you want reject all changes?"
                                        onConfirm={() => cancelPatientScreening()}
                                    >
                                        <button className="grid place-items-center basis-36 border-green border-2 rounded-lg py-2 text-gray-dark">
                                            Discard
                                        </button>
                                    </AlertDialogMenu>

                                    <AlertDialogMenu
                                        heading="Accept patient screening results?"
                                        content='This action will save the results for all echocardiograms involved in the screening and mark them as reviewed. Are you sure you want to proceed?'
                                        onConfirm={() => acceptPatientScreening()}
                                    >
                                        <button className="basis-36 flex items-center justify-center gap-2 bg-green-dark rounded-lg py-2 px-6 text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 16 16">
                                                <path fill="currentColor" fillRule="evenodd" d="M2 2.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V7h-1V3H3v10h2.005v1H2.5a.5.5 0 0 1-.5-.5zm11.994 6.832l-4.52 4.519a.5.5 0 0 1-.706 0l-2.51-2.51l.706-.708l2.157 2.157l4.166-4.166z" clipRule="evenodd" />
                                            </svg>
                                            Accept
                                        </button>
                                    </AlertDialogMenu>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}

function Accordion({ title, first=false, children, className="" }) {
    const [isOpen, setIsOpen] = useState(first)

    return (
        <div className={`border border-gray-medium rounded-lg overflow-hidden ${className}`}>
            <button
                className="w-full px-4 py-3 text-left font-medium flex justify-between items-center bg-gray-soft"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{title}</span>
                <svg className={`w-5 h-5 transform transition-transform text-gray-medium ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-4 border-t border-t-gray-medium">
                    {children}
                </div> 
            )}
        </div>
    )
}

function Card({ children, className="", ...props }) {
    return (
        <div
            className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}
            {...props}
        >
            {children}
        </div>
    )
}

function Badge({ children, className="", ...props }) {
    return (
        <span
            className={`px-2 py-1 text-xs text-white rounded-full ${className}`}
            {...props}
        >
            {children}
        </span>
    )
}

function ProgressBar({ progress, className="", barClassName="" }) {
    return (
        <div className={`w-full bg-gray-pale rounded-full h-2 ${className}`}>
            <div 
                className={`h-full rounded-full ${barClassName}`} 
                style={{ width: `${progress}%`}} 
            />
        </div>
    )
}

function FrameCard({ frame }) {
    
    const getStatusColor = (status) => {
        switch(status) {
            case 'SUCCESS': return 'bg-green';
            case 'PROGRESS': return 'bg-orange-700';
            case 'FAILURE': return 'bg-red-dark';
            default: return 'bg-gray-medium';
        }
    }

    return (
        <Card className="overflow-hidden">
            <div className="flex justify-between items-center p-3 bg-gray-50 border-b border-b-gray-medium">
                <h6 className="font-medium truncate">{frame.image_name?.split('/')[frame.image_name.split('/').length - 1]}</h6>
                <Badge className={getStatusColor(frame.status)}>
                    {frame.status}
                </Badge>
            </div>

            <div className="p-4">
                {frame.status === 'PROGRESS' && (
                    <div className="mb-3">
                        <p className="text-sm text-gray-medium-dark mb-2">{frame.phase}</p>
                        <ProgressBar 
                            progress={frame.progress}
                            className="h-2 bg-gray-pale rounded-full overflow-hidden"
                            barClassName="bg-green-700"
                        />
                    </div>
                )}

                {frame.status === 'SUCCESS' && (
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-medium-dark">Binary Classification</span>
                            <span className="font-light">
                                <div className='py-px px-2 bg-green text-white text-sm rounded-xl'>
                                    {frame.results.binary_classification === 1 ? 'Calcified' : 'Not Calcified'}
                                </div>
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-medium-dark">Classification</span>
                            <span className="font-medium">{Math.round(Number(frame.results.classification * 1000)) / 1000}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-medium-dark">Confidence</span>
                            <span className="font-medium">{frame.results.confidence}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-medium-dark mb-2">Bounding box</span>
                            <div className="grid grid-cols-2 grid-rows-2 justify-items-start gap-x-4 min-w-20 max-w-50 w-full">
                                <div>
                                    <span className='font-bold mr-4'>X1</span>
                                    <span className="font-medium">{frame.results.bbox.x1},</span>
                                </div>
                                <div className="font-medium">
                                    <span className='font-bold mr-4'>Y1</span>
                                    <span className="font-medium">{frame.results.bbox.y1}</span>
                                </div>
                                <div>
                                    <span className='font-bold mr-4'>X2</span>
                                    <span className="font-medium">{frame.results.bbox.x2},</span>
                                </div>
                                <div>
                                    <span className='font-bold mr-4'>Y2</span>
                                    <span className="font-medium">{frame.results.bbox.y2}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {frame.status === 'FAILURE' && (
                    <div className="text-red text-sm">
                        Error processing this frame. Please try again.
                    </div>
                )}
            </div>
        </Card>
    )
}
