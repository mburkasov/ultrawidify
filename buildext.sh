#!/bin/bash

# Takes all the files from 'src' and compiles it intro a single content script.
# Also compiles background scripts and settings pages. 
#
# I'm using this over something like requirejs so my extension doesn't need even more
# dependencies.
#
# How does this work?
# 0. You're supposed to run this in the root directory of the extension.

# 1. see if file has any #include [filename] comments. If so, merge [filename] file
#    into the current file (after checking if that file has any #include comments
#    Compiled files are saved to /tmp.
# 
# 2. After compiling file and its dependencies, check for presence of #location [directory]
#    comments. [directory] is relative to the root directory of the extension
# 2.1 also check for #out, which defines filename.
#
# 3. Use '-nodebug' to remove all calls of console.log (to be implemented)

function flattenFileName {
  echo $1 | sed 's/\//_/g'
}

fileList="";

function compileFile {
  local file=$1
  local flatfile=$(flattenFileName $file);

  
  if [ -f /tmp/$flatfile ] ; then
    return 0
  fi;
  
  fileList="$fileList $flatfile"
  
  # let's take all the #included files and put them at the top  
  for f in $(grep "#include" $file | awk '{print $NF}') ; do
    
    local lf=$f
    fflat=$(flattenFileName $lf);
    
    compileFile $lf
    
    printf "\n//BEGIN included from $lf\n" >> /tmp/$flatfile
    grep -Ev "#include|#location|#out" /tmp/$fflat >> /tmp/$flatfile
    printf "//END included from $lf\n\n" >> /tmp/$flatfile
    
  done
  
  grep -Ev "#include|#location|#out" $file >> /tmp/$flatfile
}

cd src;

for file in *.js ; do
  echo "main loop, we're looking at this file: $file"
  compileFile $file
  echo "Files compiled. Moving to location (if specified)"
  
  outFile=$file
  
  if grep -q "#out" $file ; then
    outFile=$( grep "#out" $file | awk '{print $NF}')
  fi
  
  
  
  if grep -q "#location" $file ; then
    location=$( grep "#location" $file | awk '{print $NF}')
    echo "File will be saved to $location as $outFile"
    cd ..
    echo "// Autogenerated using buildext. This file should not be modified — modify source files instead." > $location/$outFile
    grep -Ev "#location|#include|#out" /tmp/$(flattenFileName $file) >> $location/$outFile
    cd src
  fi
done

# perform cleanup
for file in $fileList ; do
  rm /tmp/$file
done
