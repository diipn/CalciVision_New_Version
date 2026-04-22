import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { getPatientAge } from '../utils/patientAge';

const styles = StyleSheet.create({
  page: { 
    padding: 18,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.15,
    color: '#292121'
  },
  header: {
    marginBottom: 10,
    borderBottom: '1.5 solid #2F7D5D',
    paddingBottom: 5
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 3,
    color: '#2F7D5D',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 9.5,
    fontWeight: 'normal',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6,
    color: '#727272',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  patientInfo: {
    marginBottom: 10,
    padding: 7,
    backgroundColor: '#E6F6EA',
    borderRadius: 3,
    border: '1 solid #D3EBD7'
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 4,
    color: '#2F7D5D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1 solid #E8E8E8',
    paddingBottom: 1.5
  },
  paragraph: {
    marginBottom: 3,
    textAlign: 'justify',
    lineHeight: 1.2
  },
  findings: {
    marginLeft: 8,
    marginBottom: 2,
    fontSize: 8.5
  },
  conclusion: {
    marginTop: 6,
    padding: 7,
    backgroundColor: '#F2FBF4',
    borderRadius: 3,
    border: '1 solid #D3EBD7'
  },
  signature: {
    marginTop: 12,
    textAlign: 'center',
    borderTop: '1 solid #E8E8E8',
    paddingTop: 10
  },
  date: {
    textAlign: 'right',
    fontSize: 8,
    color: '#727272',
    marginBottom: 2
  },
  institutionHeader: {
    textAlign: 'center',
    marginBottom: 8,
    padding: 5,
    backgroundColor: '#F0F0F0',
    borderRadius: 3
  },
  institutionName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#292121',
    marginBottom: 1
  },
  institutionDetails: {
    fontSize: 7.5,
    color: '#727272'
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1.5
  },
  patientLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#292121',
    width: '35%'
  },
  patientValue: {
    fontSize: 8.5,
    color: '#292121',
    width: '65%'
  },
  findingItem: {
    flexDirection: 'row',
    marginBottom: 1.5,
    alignItems: 'flex-start'
  },
  findingBullet: {
    fontSize: 8.5,
    color: '#2F7D5D',
    marginRight: 4,
    marginTop: 1
  },
  findingText: {
    fontSize: 8,
    flex: 1,
    lineHeight: 1.15
  },
  highlight: {
    backgroundColor: '#CFF2D8',
    padding: 1,
    borderRadius: 1
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E8E8E8',
    marginVertical: 4
  },
  pageBreak: {
    break: 'before'
  },
  compactSection: {
    marginTop: 4,
    marginBottom: 3
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 10,
    right: 18,
    color: '#727272'
  },
  reportSection: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#E6F6EA',
    borderRadius: 3,
    border: '1 solid #D3EBD7'
  }
});

const ReportPDF = ({ data, patient, medico, reportText }) => {
  const hasCalcification = data.some(item => item.is_calcified);
  const calcifiedFrames = data.filter(item => item.is_calcified).length;
  const totalFrames = data.length;
  const calcificationPercentage = totalFrames > 0 ? ((calcifiedFrames / totalFrames) * 100).toFixed(1) : 0;
  const patientAge = getPatientAge(patient);
  const currentDate = new Date().toLocaleDateString('en-US', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });

  return (
  <Document>
    {/* PAGE 1 - Patient Information and Technical Data */}
    <Page style={styles.page}>
      {/* Institution Header */}
      <View style={styles.institutionHeader}>
        <Text style={styles.institutionName}>CALCIVISION</Text>
        <Text style={styles.institutionDetails}>Artificial Intelligence Echocardiographic Analysis System</Text>
      </View>

      {/* Date */}
      <Text style={styles.date}>Date: {currentDate}</Text>

      {/* Main Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ECHOCARDIOGRAPHIC REPORT</Text>
        <Text style={styles.subtitle}>Aortic Valve Assessment</Text>
      </View>

      {/* Patient Information */}
      <View style={styles.patientInfo}>
        <Text style={styles.sectionTitle}>PATIENT INFORMATION</Text>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Name:</Text>
          <Text style={styles.patientValue}>{patient.name}</Text>
        </View>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Age:</Text>
          <Text style={styles.patientValue}>{patientAge !== null ? `${patientAge} years` : 'N/A'}</Text>
        </View>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Exam Date:</Text>
          <Text style={styles.patientValue}>{currentDate}</Text>
        </View>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Responsible Physician:</Text>
          <Text style={styles.patientValue}>Dr. {medico.first_name} {medico.last_name}</Text>
        </View>
      </View>

      {/* Clinical Indication */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>CLINICAL INDICATION</Text>
        <Text style={styles.paragraph}>
          Echocardiographic assessment of the aortic valve for investigation of valvular calcification using artificial intelligence-assisted analysis.
        </Text>
      </View>

      {/* Technical Data */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>TECHNICAL DATA</Text>
        <Text style={styles.paragraph}>
          Examination performed with cardiac ultrasound equipment, using AI for automated detection of valvular calcification.
        </Text>
        
        <View style={styles.findingItem}>
          <Text style={styles.findingBullet}>•</Text>
          <Text style={styles.findingText}>Total frames analyzed: <Text style={styles.highlight}>{totalFrames}</Text></Text>
        </View>
        
        <View style={styles.findingItem}>
          <Text style={styles.findingBullet}>•</Text>
          <Text style={styles.findingText}>Frames with calcification detected: <Text style={styles.highlight}>{calcifiedFrames}</Text></Text>
        </View>
        
        <View style={styles.findingItem}>
          <Text style={styles.findingBullet}>•</Text>
          <Text style={styles.findingText}>Calcification percentage: <Text style={styles.highlight}>{calcificationPercentage}%</Text></Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* REGION OF INTEREST ANNOTATIONS - MOVED TO PAGE 1 */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>REGION OF INTEREST ANNOTATIONS</Text>
        <Text style={styles.paragraph}>
          Coordinates of anatomical regions identified for aortic valve analysis:
        </Text>
        
        {data.slice(0, Math.min(data.length, 6)).map((frame, index) => {
          if (!frame.rects || frame.rects.length === 0) return null;
          
          const rect = frame.rects;
          const isAIGenerated = frame.is_annotation_generated;
          
          return (
            <View key={index} style={styles.findingItem}>
              <Text style={styles.findingBullet}>•</Text>
              <Text style={styles.findingText}>
                Frame {index + 1}: ({Math.round(rect.x)}, {Math.round(rect.y)}) - 
                {Math.round(rect.width)}×{Math.round(rect.height)}px
                {isAIGenerated && (
                  <Text style={{fontSize: 7, color: '#727272'}}> (AI)</Text>
                )}
              </Text>
            </View>
          );
        })}
        
        {data.length > 6 && (
          <Text style={{fontSize: 8, color: '#727272', marginTop: 2}}>
            ... and {data.length - 6} additional coordinates (details on page 2)
          </Text>
        )}
      </View>

      {/* ECHOCARDIOGRAPHIC FINDINGS */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>ECHOCARDIOGRAPHIC FINDINGS</Text>
        <Text style={styles.paragraph}>
          <Text style={{fontWeight: 'bold'}}>Aortic Valve: </Text>
          {hasCalcification ? (
            `Evidence of aortic valvular calcification. Presence of calcific deposits in valve leaflets observed in ${calcificationPercentage}% of analyzed frames, suggestive of ${calcificationPercentage > 50 ? 'moderate to severe calcification' : 'mild to moderate calcification'}.`
          ) : (
            'Aortic valve with preserved morphology, without evidence of significant calcification in the analyzed frames.'
          )}
        </Text>
        
        {hasCalcification && (
          <Text style={styles.paragraph}>
            The presence of aortic valvular calcification may be associated with varying degrees of flow obstruction, requiring correlation with hemodynamic data for complete assessment.
          </Text>
        )}
      </View>      {/* Binary Classification Analysis - REDUCED */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>BINARY CLASSIFICATION ANALYSIS</Text>
        <Text style={styles.paragraph}>
          Automated classification system using AI model for valvular calcification detection:
        </Text>
        
        {data.slice(0, Math.min(data.length, 4)).map((frame, index) => {
          if (!frame.rects || frame.rects.length === 0) return null;
          
          const confidence = frame.confidence ? parseFloat(frame.confidence) : 0;
          const isAIGenerated = frame.is_calcification_generated;
          
          return (
            <View key={index} style={styles.findingItem}>
              <Text style={styles.findingBullet}>•</Text>
              <Text style={styles.findingText}>
                Frame {index + 1}: {frame.is_calcified ? 'CALCIFIED' : 'NOT-CALCIFIED'} 
                {confidence > 0 && (
                  <Text> - {confidence.toFixed(1)}%</Text>
                )}
                {isAIGenerated && (
                  <Text style={{fontSize: 7, color: '#727272'}}> (AI)</Text>
                )}
              </Text>
            </View>
          );
        })}
        
        {data.length > 4 && (
          <Text style={{fontSize: 8, color: '#727272', marginTop: 4}}>
            ... and {data.length - 4} additional frames analyzed
          </Text>
        )}
      </View>

      <View style={styles.divider} />

      {reportText && (
        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>OBSERVAÇÕES CLÍNICAS</Text>
          <Text style={styles.paragraph}>{reportText}</Text>
        </View>
      )}

      {/* Conclusion */}
      <View style={styles.conclusion}>
        <Text style={styles.sectionTitle}>CONCLUSION</Text>
        <Text style={styles.paragraph}>
          {hasCalcification ? (
            `Echocardiogram demonstrates aortic valve calcification in ${calcificationPercentage}% of analyzed frames. Complementary hemodynamic assessment and specialized cardiac follow-up are recommended.`
          ) : (
            'Echocardiogram with normal-appearing aortic valve, without evidence of significant calcification at the time of examination.'
          )}
        </Text>
      </View>

      {/* Signature */}
      <View style={styles.signature}>
        <Text>____________________________________</Text>
        <Text style={{fontWeight: 'bold', marginTop: 6, fontSize: 10}}>
          Dr. {medico?.first_name || 'Médico'} {medico?.last_name || ''}
        </Text>
        <Text style={{fontSize: 9, marginTop: 2}}>Cardiologist</Text>
        <Text style={{fontSize: 7, marginTop: 8, color: '#727272'}}>
          Report generated with artificial intelligence assistance - CalciVision System
        </Text>
      </View>
    </Page>
  </Document>
);
};

export default ReportPDF;
