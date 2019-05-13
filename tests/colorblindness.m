% implementation of Algorithm 1: LMS Daltonization from "Smartphone Based
% Image Color Correction for Color Blindness" -- Lamiaa A. Elrefaei


% Inputs:
rgb = [206 121 117].';
   
   
% step 1
lms = [17.8824 43.5161 4.11935
       3.45565 27.1554 3.86714
       0.0299566 0.184309 1.46709] * rgb;

% step 2
lms_p = [0 2.02344 -2.52581
         0 1 0
         0 0 1] * lms;
lms_d = [1 0 0
         0.49421 0 1.24827
         0 0 1] * lms;
lms_t = [1 0 0
         0 1 0
         -0.395913 0.801109 0] * lms;
     
% step 3
rgb_to_lms_transform = [0.0809444479 -0.130504409 0.116721066
    
                        % In the original research paper, the second row of 
                        % this matrix is incorrect. The paper lists it as:
                        % 0.113614708 -0.0102485335 0.0540193266
                        %
                        % However, this matrix is "intended" to be an
                        % inverse of the matrix from step 1: step 1
                        % transforms from rgb space to lms space, and this
                        % step transforms back to rgb space.
                        %
                        % Therefore, we have included the corrected version
                        % of the second row, which comes from the inverse
                        % of step 1:
                        -0.010248533515 0.054019326636 -0.1136147082

                        -0.000365296938 -0.00412161469 0.693511405];
                    
rgb_p = rgb_to_lms_transform * lms_p;
rgb_d = rgb_to_lms_transform * lms_d;
rgb_t = rgb_to_lms_transform * lms_t;

% step 4
d_p = rgb - rgb_p;
d_d = rgb - rgb_d;
d_t = rgb - rgb_t;

% step 5
rgb_map_p = [0 0 0
             0.7 1 0
             0.7 0 1] * d_p;
rgb_map_d = [1 0.7 0
             0 0 0
             0 0.7 1] * d_d;
rgb_map_t = [1 0 0.7
             0 1 0.7
             0 0 0] * d_t;
        
% step 6 (output)
rgb_filtered_p = min(255, max(0, round(rgb + rgb_map_p)))
rgb_filtered_d = min(255, max(0, round(rgb + rgb_map_d)))
rgb_filtered_t = min(255, max(0, round(rgb + rgb_map_t)))

